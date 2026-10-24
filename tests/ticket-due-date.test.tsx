// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { TicketDueDate } from "@/features/requests/components/ticket-due-date";
import { updateTicketDueDate } from "@/features/requests/api/request-detail-api";
import { requestDetailSchema } from "@/features/requests/schemas/request-detail-schema";
import { requestDetailFixture } from "./fixtures/request-detail";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/requests/api/request-detail-api", () => ({
  updateTicketDueDate: vi.fn(),
}));
let client: QueryClient;
const onSaved = vi.fn<() => Promise<unknown>>();
const ticket = requestDetailSchema.parse({
  ...requestDetailFixture,
  ticket_status: 3,
  duedate: "2026-10-30",
});
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  onSaved.mockReset().mockResolvedValue(undefined);
  vi.mocked(updateTicketDueDate).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  client.clear();
});
function editor(duedate = ticket.duedate) {
  return (
    <QueryClientProvider client={client}>
      <TicketDueDate ticket={{ ...ticket, duedate }} onSaved={onSaved} />
    </QueryClientProvider>
  );
}
function openEditor() {
  fireEvent.click(screen.getByRole("button", { name: "Đổi ngày mong muốn" }));
}
function input() {
  return document.getElementById("ticket-due-date") as HTMLInputElement;
}
it("updates an untouched date when fresh detail replaces the cached ticket", () => {
  const view = render(editor());
  openEditor();
  expect(input().value).toBe("30/10/2026");
  view.rerender(editor("2026-12-02"));
  expect(input().value).toBe("02/12/2026");
});
it("preserves a date being edited when detail refreshes", () => {
  const view = render(editor());
  openEditor();
  fireEvent.change(input(), { target: { value: "10/12/2026" } });
  view.rerender(editor("2026-12-02"));
  expect(input().value).toBe("10/12/2026");
});
it("waits for refreshed detail before announcing success and allowing a new edit", async () => {
  let resolveRefresh!: () => void;
  onSaved.mockReturnValue(
    new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    }),
  );
  const view = render(editor());
  openEditor();
  fireEvent.change(input(), { target: { value: "02/12/2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu ngày mong muốn" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(input().disabled).toBe(true);
  expect(toast.success).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "Đổi ngày mong muốn" }),
  ).toBeNull();
  view.rerender(editor("2026-12-02"));
  await act(async () => resolveRefresh());
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Lưu ngày mong muốn" }),
    ).toBeNull(),
  );
  openEditor();
  expect(input().value).toBe("02/12/2026");
  expect(updateTicketDueDate).toHaveBeenCalledOnce();
});
