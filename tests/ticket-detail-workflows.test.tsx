// @vitest-environment jsdom
import { toast } from "sonner";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TicketDueDate } from "@/features/requests/components/ticket-due-date";
import { TicketAttachments } from "@/features/requests/components/ticket-attachments";
import {
  updateTicketDueDate,
  updateTicketSection,
} from "@/features/requests/api/request-detail-api";
import { addTicketComment } from "@/features/requests/api/ticket-discussion-api";
import { uploadRequestAttachment } from "@/features/requests/api/create-request-api";
import { TicketCloneButton } from "@/features/requests/components/ticket-clone-button";
import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/context/auth-context";
import { requestDetailSchema } from "@/features/requests/schemas/request-detail-schema";
import { requestDetailFixture } from "./fixtures/request-detail";
import { settingsFixtures } from "./fixtures/settings";
import { setCookie } from "@/lib/cookies";
import { clearAuthSession } from "@/lib/auth-session";
import { COOKIE_TOKEN_KEY } from "@/constants/auth";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fetchMock = vi.fn<typeof fetch>();
const onSaved = vi.fn<() => Promise<unknown>>();
let client: QueryClient;
const ticket = () =>
  requestDetailSchema.parse({
    ...requestDetailFixture,
    handling_group: 5,
    ticket_type: 186,
    duedate: "2026-10-30",
  });
beforeEach(() => {
  clearAuthSession();
  setCookie(COOKIE_TOKEN_KEY, "test-token");
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  fetchMock.mockResolvedValue(Response.json({ message: "OK" }));
  onSaved.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  client.clear();
  clearAuthSession();
});
function open(component: React.ReactNode) {
  return render(
    <QueryClientProvider client={client}>{component}</QueryClientProvider>,
  );
}
it("extends the due date, prevents duplicate saves, and reloads the ticket", async () => {
  open(<TicketDueDate ticket={ticket()} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: "Đổi ngày mong muốn" }));
  fireEvent.change(screen.getByLabelText(/Ngày mong muốn/), {
    target: { value: "02/11/2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu ngày mong muốn" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
    ticket_id: 42,
    duedate: "2026-11-02",
  });
});
it.each(["30/10/2026", "29/10/2026", "31/02/2026", ""])(
  "rejects an unchanged, earlier, or invalid deadline: %s",
  async (date) => {
    await expect(updateTicketDueDate(42, date, "2026-10-30")).rejects.toThrow(
      "phải sau",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  },
);
it.each([4, 5, 7, 8])(
  "does not offer a due-date change in status %s",
  (status) => {
    open(
      <TicketDueDate
        ticket={{ ...ticket(), ticket_status: status }}
        onSaved={onSaved}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Đổi ngày mong muốn" }),
    ).toBeNull();
  },
);
it("retries only the remaining uploads after partial success", async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json({ message: "OK" }))
    .mockResolvedValueOnce(Response.json({ error: "Upload failed" }))
    .mockResolvedValueOnce(Response.json({ message: "OK" }));
  const { container } = open(
    <TicketAttachments ticket={ticket()} onSaved={onSaved} />,
  );
  const first = new File(["one"], "one.txt"),
    second = new File(["two"], "two.txt");
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [first, second] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tải lên đính kèm" }));
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "Upload failed",
      expect.objectContaining({ id: expect.any(String) }),
    ),
  );
  expect(screen.queryByText("one.txt")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tải lại tệp còn lại" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(
    fetchMock.mock.calls.map(
      ([, options]) =>
        ((options!.body as FormData).get("att_file") as File).name,
    ),
  ).toEqual(["one.txt", "two.txt", "two.txt"]);
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
});
it("does not reload the ticket or retry automatically when the first upload fails", async () => {
  fetchMock.mockResolvedValue(Response.json({ error: "Upload failed" }));
  const { container } = open(
    <TicketAttachments ticket={ticket()} onSaved={onSaved} />,
  );
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: {
      files: [new File(["one"], "one.txt"), new File(["two"], "two.txt")],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tải lên đính kèm" }));
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "Upload failed",
      expect.objectContaining({ id: expect.any(String) }),
    ),
  );
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByText("one.txt")).toBeTruthy();
  expect(screen.getByText("two.txt")).toBeTruthy();
});
it("rejects access-denied success responses for comments, details, and uploads", async () => {
  fetchMock.mockImplementation(async () =>
    Response.json({ message: "You do not have access" }),
  );
  await expect(addTicketComment(42, "Draft")).rejects.toThrow("quyền");
  await expect(updateTicketSection(42, {}, [])).rejects.toThrow("quyền");
  await expect(
    uploadRequestAttachment(42, new File(["a"], "note.txt")),
  ).rejects.toThrow("quyền");
});
it.each([
  { can_view: true, is_superuser: true },
  { can_create: false, is_superuser: true },
])(
  "hides copying without can_create even with a Django superuser flag: %j",
  (permissions) => {
    open(
      <AuthContext.Provider value={{ permissions } as AuthContextValue}>
        <MemoryRouter>
          <TicketCloneButton ticket={ticket()} />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.queryByRole("button", { name: "Sao chép" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it("opens a copy in the creation form without creating a ticket", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      count: 1,
      next: null,
      previous: null,
      results: [settingsFixtures["request-types"]],
    }),
  );
  open(
    <AuthContext.Provider
      value={{ permissions: { can_create: true } } as AuthContextValue}
    >
      <MemoryRouter initialEntries={["/requests/42"]}>
        <Routes>
          <Route
            path="/requests/42"
            element={<TicketCloneButton ticket={ticket()} />}
          />
          <Route path="/requests/new" element={<p>Creation form</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /^Sao chép$/ }));
  await screen.findByText("Creation form");
  expect(
    fetchMock.mock.calls.every(([, options]) => options?.method === "GET"),
  ).toBe(true);
});
