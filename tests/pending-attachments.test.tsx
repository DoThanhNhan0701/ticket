// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryRouter,
  Link,
  Outlet,
  RouterProvider,
} from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PendingAttachmentsProvider } from "@/features/requests/providers/pending-attachments-provider";
import { TicketAttachments } from "@/features/requests/components/ticket-attachments";
import { CommentComposer } from "@/features/requests/components/comment-composer";
import { requestDetailSchema } from "@/features/requests/schemas/request-detail-schema";
import { requestDetailFixture } from "./fixtures/request-detail";
import { COOKIE_TOKEN_KEY } from "@/constants/auth";
import { clearAuthSession } from "@/lib/auth-session";
import { setCookie } from "@/lib/cookies";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let router: ReturnType<typeof createMemoryRouter>;
let client: QueryClient;
const fetchMock = vi.fn<typeof fetch>();
const saved = vi.fn();

beforeEach(() => {
  clearAuthSession();
  setCookie(COOKIE_TOKEN_KEY, "pending-attachments-access");
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  saved.mockResolvedValue(undefined);
  fetchMock.mockResolvedValue(Response.json({ message: "OK" }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
});
afterEach(() => {
  cleanup();
  router.dispose();
  client.clear();
  clearAuthSession();
});

function open({ composer = false, history = false } = {}) {
  router = createMemoryRouter(
    [
      {
        element: (
          <PendingAttachmentsProvider>
            <Outlet />
          </PendingAttachmentsProvider>
        ),
        children: [
          {
            path: "/requests/42",
            element: (
              <>
                <Link to="/requests">Danh sách</Link>
                <Link to="?tab=discussion">Trao đổi</Link>
                <section aria-label="Tệp ticket">
                  <TicketAttachments
                    ticket={requestDetailSchema.parse({
                      ...requestDetailFixture,
                      attachment_files: {},
                    })}
                    onSaved={saved}
                  />
                </section>
                {composer && <CommentComposer onSend={saved} onSaved={saved} />}
              </>
            ),
          },
          { path: "/requests", element: <h1>Danh sách yêu cầu</h1> },
          { path: "/forbidden", element: <h1>Không có quyền</h1> },
        ],
      },
    ],
    {
      initialEntries: history
        ? ["/requests", "/requests/42"]
        : ["/requests/42"],
    },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
function attach() {
  fireEvent.change(
    within(screen.getByRole("region", { name: "Tệp ticket" })).getByLabelText(
      "Tệp đính kèm",
    ),
    { target: { files: [new File(["pending"], "pending.txt")] } },
  );
}
const leave = () =>
  fireEvent.click(screen.getByRole("link", { name: "Danh sách" }));
const warnBeforeUnload = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

it("does not block navigation when there are no pending files", async () => {
  open();
  expect(warnBeforeUnload()).toBe(false);
  leave();
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("warns before leaving, keeps selected files on stay, and leaves only after confirmation", async () => {
  open();
  attach();
  leave();
  await screen.findByRole("dialog", { name: "Tệp đính kèm chưa được gửi" });
  expect(router.state.location.pathname).toBe("/requests/42");
  fireEvent.click(screen.getByRole("button", { name: "Ở lại" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(
    screen.getByRole("button", { name: "Bỏ tệp pending.txt" }),
  ).toBeTruthy();
  leave();
  fireEvent.click(await screen.findByRole("button", { name: "Rời trang" }));
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(warnBeforeUnload()).toBe(false);
});

it("warns for browser back but allows tab changes within the same ticket", async () => {
  open({ history: true });
  attach();
  await act(async () => {
    void router.navigate(-1);
  });
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "Ở lại" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("link", { name: "Trao đổi" }));
  await waitFor(() =>
    expect(router.state.location.search).toBe("?tab=discussion"),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(warnBeforeUnload()).toBe(true);
});

it("warns on reload/close while files remain and stops warning when the last file is removed", () => {
  open();
  attach();
  expect(warnBeforeUnload()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Bỏ tệp pending.txt" }));
  expect(warnBeforeUnload()).toBe(false);
});

it("allows navigation after a successful upload", async () => {
  open();
  attach();
  fireEvent.click(screen.getByRole("button", { name: "Tải lên đính kèm" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  await waitFor(() => expect(warnBeforeUnload()).toBe(false));
  leave();
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
});

it("still warns when an upload fails", async () => {
  fetchMock.mockResolvedValue(Response.json({ error: "Upload failed" }));
  open();
  attach();
  fireEvent.click(screen.getByRole("button", { name: "Tải lên đính kèm" }));
  await screen.findByRole("button", { name: "Tải lại tệp còn lại" });
  leave();
  await screen.findByRole("dialog");
  expect(warnBeforeUnload()).toBe(true);
});

it("proceeds if an in-flight upload finishes while the warning is open", async () => {
  let finish!: (response: Response) => void;
  fetchMock.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  open();
  attach();
  fireEvent.click(screen.getByRole("button", { name: "Tải lên đính kèm" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  leave();
  await screen.findByRole("dialog");
  await act(async () => finish(Response.json({ message: "OK" })));
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
});

it("tracks files in the reply composer as well as the ticket attachment area", async () => {
  open({ composer: true });
  attach();
  const form = screen.getByRole("form", { name: "Phản hồi mới" });
  fireEvent.change(within(form).getByLabelText("Tệp đính kèm"), {
    target: { files: [new File(["reply"], "reply.txt")] },
  });
  leave();
  await screen.findByRole("dialog");
  expect(screen.getByText(/Bạn còn 2 tệp đính kèm/)).toBeTruthy();
});

it("does not block access-denied redirects", async () => {
  open();
  attach();
  await act(async () => {
    await router.navigate("/forbidden");
  });
  await screen.findByRole("heading", { name: "Không có quyền" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("does not warn when reselecting the current detail tab", async () => {
  open();
  attach();
  await act(async () => {
    await router.navigate("?tab=general");
  });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Bỏ tệp pending.txt" }),
  ).toBeTruthy();
  expect(warnBeforeUnload()).toBe(true);
});
