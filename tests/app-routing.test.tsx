// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "@/app/app";
import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/context/auth-context";

let client: QueryClient;
let auth: AuthContextValue;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  auth = {
    token: "ticket-session",
    username: "ticket-user",
    userId: 1,
    avatarUrl: null,
    permissions: null,
    userPermission: null,
    isInitializing: false,
    isLoading: false,
    error: null,
    login: vi.fn().mockResolvedValue(true),
    logout: vi.fn(),
    setError: vi.fn(),
    refreshUserPermission: vi.fn().mockResolvedValue(null),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  client.clear();
});

function renderApp(path = "/") {
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

it("opens the Ticket shell with the remaining account navigation", async () => {
  renderApp();
  expect(await screen.findByRole("heading", { name: "Ticket" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "User Management" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Change Password" })).toBeNull();
  expect(screen.getByRole("button", { name: "Sign Out" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: /Switch to .* theme/ }),
  ).toBeTruthy();
});

it.each(["/", "/change-password"])(
  "protects %s when signed out",
  async (path) => {
    auth.token = null;
    renderApp(path);
    expect(
      await screen.findByRole("button", { name: "Sign In to Ticket" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Ticket" })).toBeNull();
  },
);

it.each(["/login", "/dashboard", "/users", "/change-password"])(
  "returns signed-in visitors from %s to Ticket",
  async (path) => {
    renderApp(path);
    expect(await screen.findByRole("heading", { name: "Ticket" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Applications" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "User Management" }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Change Password" }),
    ).toBeNull();
  },
);
