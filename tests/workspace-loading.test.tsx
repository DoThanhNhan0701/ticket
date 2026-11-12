// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import App from "@/app/app";

const { auth, started, finish, ready } = vi.hoisted(() => {
  let finish!: () => void;
  const ready = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return {
    ready,
    finish: () => finish(),
    started: vi.fn(),
    auth: {
      token: "ticket-session",
      isInitializing: true,
      accessDenied: false,
      username: "test-user",
      avatarUrl: null,
      permissions: { can_view: true },
      logout: vi.fn(),
    },
  };
});
vi.mock("@/features/auth/hooks/use-auth-context", () => ({
  useAuthContext: () => auth,
}));
vi.mock("@/pages/workspace", async () => {
  started();
  await ready;
  return { WorkspacePage: () => <h1>Loaded requests</h1> };
});
vi.mock("sonner", () => ({ Toaster: () => null }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps one workspace frame from authentication through lazy loading without exposing cached permissions", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  const tree = () => (
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );
  const view = render(tree());
  await waitFor(() => expect(started).toHaveBeenCalledOnce());
  const header = screen.getByRole("banner");
  const sidebar = screen.getByRole("complementary");
  const main = screen.getByRole("main");
  expect(main.getAttribute("aria-busy")).toBe("true");
  expect(main.querySelector("[data-workspace-loading]")).not.toBeNull();
  expect(screen.queryByText("Đang tải không gian Ticket...")).toBeNull();
  expect(screen.queryByText("test-user")).toBeNull();
  expect(screen.queryByRole("link", { name: "Danh sách yêu cầu" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Loaded requests" })).toBeNull();

  auth.isInitializing = false;
  view.rerender(tree());
  expect(screen.getByRole("banner")).toBe(header);
  expect(screen.getByRole("complementary")).toBe(sidebar);
  expect(screen.getByRole("main")).toBe(main);
  expect(main.getAttribute("aria-busy")).toBe("false");
  expect(main.querySelector('[role="status"]')).not.toBeNull();
  expect(screen.queryByRole("heading", { name: "Loaded requests" })).toBeNull();

  await act(async () => {
    finish();
    await ready;
  });
  await screen.findByRole("heading", { name: "Loaded requests" });
  expect(screen.getByRole("banner")).toBe(header);
  expect(screen.getByRole("complementary")).toBe(sidebar);
  expect(screen.getByRole("main")).toBe(main);
});
