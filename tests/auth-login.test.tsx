// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "@/app/app";
import { AuthProvider } from "@/features/auth/providers/auth-provider";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { clearAuthSession } from "@/lib/auth-session";
import { deleteCookie, getCookie, setCookie } from "@/lib/cookies";
import { queryClient } from "@/lib/query-client";
import {
  COOKIE_REFRESH_KEY,
  COOKIE_TOKEN_KEY,
  STORAGE_USERNAME_KEY,
  STORAGE_USER_PERMISSION_KEY,
} from "@/constants/auth";

const fetchMock = vi.fn<typeof fetch>();
const tokens = { access: "ticket-access", refresh: "ticket-refresh" };
const account = {
  infoUser: [
    42,
    "Ticket User",
    "https://ticket-api.aiminds.io.vn/media/avatar.png",
  ],
  userPermission: ["can_accept", "can_report"],
  handlingPermission: { support: ["can_reply"] },
  is_handling: true,
  is_admin: false,
  is_superuser: false,
  can_assign: true,
};

beforeEach(() => {
  clearAuthSession();
  localStorage.clear();
  queryClient.clear();
  window.history.replaceState(null, "", "/login");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
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
  clearAuthSession();
  deleteCookie("_access_token_homepage");
  queryClient.clear();
});

function SessionDetails() {
  const { userId, avatarUrl, permissions } = useAuthContext();
  return (
    <output data-testid="account">
      {JSON.stringify({ userId, avatarUrl, permissions })}
    </output>
  );
}

function renderApp(path = "/login") {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
          <SessionDetails />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

async function submitLogin() {
  const button = await screen.findByRole("button", {
    name: "Sign In to Ticket",
  });
  fireEvent.change(screen.getByLabelText(/Username/), {
    target: { value: "  ticket.user  " },
  });
  fireEvent.change(screen.getByLabelText(/^Password/), {
    target: { value: " password with spaces " },
  });
  fireEvent.click(button);
}

function mockSuccessfulLogin() {
  fetchMock
    .mockResolvedValueOnce(Response.json(tokens))
    .mockResolvedValueOnce(Response.json(account));
}

it("signs in using the ticketV2 token and account responses", async () => {
  mockSuccessfulLogin();
  renderApp();
  await submitLogin();

  expect(await screen.findByRole("heading", { name: "Ticket" })).toBeTruthy();
  expect(screen.getByText("Ticket User")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const [loginUrl, loginOptions] = fetchMock.mock.calls[0];
  expect(new URL(String(loginUrl)).pathname).toBe("/api/token/");
  expect(loginOptions?.method).toBe("POST");
  expect(JSON.parse(String(loginOptions?.body))).toEqual({
    username: "ticket.user",
    password: " password with spaces ",
  });
  expect(new Headers(loginOptions?.headers).has("Authorization")).toBe(false);

  const [accountUrl, accountOptions] = fetchMock.mock.calls[1];
  expect(new URL(String(accountUrl)).pathname).toBe("/api/list_permission/");
  expect(accountOptions?.method).toBe("GET");
  expect(new Headers(accountOptions?.headers).get("Authorization")).toBe(
    "Bearer ticket-access",
  );
  expect(getCookie(COOKIE_TOKEN_KEY)).toBe(tokens.access);
  expect(getCookie(COOKIE_REFRESH_KEY)).toBe(tokens.refresh);
  expect(localStorage.getItem(STORAGE_USERNAME_KEY)).toBe("Ticket User");
  const details = JSON.parse(screen.getByTestId("account").textContent ?? "{}");
  expect(details.userId).toBe(42);
  expect(details.avatarUrl).toBe(account.infoUser[2]);
  expect(details.permissions).toMatchObject({
    can_accept: true,
    can_report: true,
    can_reply: true,
    can_assign: true,
    can_process: true,
    is_admin: false,
  });
});

it("keeps sign-in pending until account information has loaded", async () => {
  let finishAccountRequest: (response: Response) => void = () => {
    throw new Error("Account request has not started.");
  };
  fetchMock.mockResolvedValueOnce(Response.json(tokens)).mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finishAccountRequest = resolve;
      }),
  );
  renderApp();
  await submitLogin();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const button = await screen.findByRole("button", {
    name: "Authenticating...",
  });
  expect(button.hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("heading", { name: "Ticket" })).toBeNull();

  finishAccountRequest(Response.json(account));
  expect(await screen.findByRole("heading", { name: "Ticket" })).toBeTruthy();
});

it("shows bad credentials and allows the user to retry", async () => {
  fetchMock.mockResolvedValueOnce(
    Response.json(
      { detail: "No active account found with the given credentials" },
      { status: 401 },
    ),
  );
  mockSuccessfulLogin();
  renderApp();
  await submitLogin();
  expect(
    await screen.findByText(
      "No active account found with the given credentials",
    ),
  ).toBeTruthy();
  expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  await submitLogin();
  expect(await screen.findByRole("heading", { name: "Ticket" })).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it.each([
  null,
  { data: tokens },
  { access: "", refresh: "refresh" },
  { access: 123, refresh: "refresh" },
  { access: "access" },
])(
  "rejects an invalid token response %j without creating a session",
  async (response) => {
    fetchMock.mockResolvedValueOnce(Response.json(response));
    renderApp();
    await submitLogin();
    expect(
      await screen.findByText(
        "Authentication tokens not received from the server.",
      ),
    ).toBeTruthy();
    expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
    expect(getCookie(COOKIE_REFRESH_KEY)).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);

it.each([401, 500])(
  "clears partial tokens when loading the account fails with %i",
  async (status) => {
    fetchMock
      .mockResolvedValueOnce(Response.json(tokens))
      .mockResolvedValueOnce(
        Response.json({ detail: "Account unavailable." }, { status }),
      );
    renderApp();
    await submitLogin();
    expect(await screen.findByText("Account unavailable.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Ticket" })).toBeNull();
    expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
    expect(getCookie(COOKIE_REFRESH_KEY)).toBeUndefined();
  },
);

it("rejects malformed account information without leaving a partial session", async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json(tokens))
    .mockResolvedValueOnce(Response.json({ infoUser: null }));
  renderApp();
  await submitLogin();
  expect(
    await screen.findByText(
      "Invalid account information received from the server.",
    ),
  ).toBeTruthy();
  expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
  expect(getCookie(COOKIE_REFRESH_KEY)).toBeUndefined();
});

it("shows network errors on the login form", async () => {
  fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  renderApp();
  await submitLogin();
  expect(await screen.findByText("Failed to fetch")).toBeTruthy();
  expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
});

it("restores a Ticket session and reloads account information", async () => {
  setCookie(COOKIE_TOKEN_KEY, tokens.access);
  setCookie(COOKIE_REFRESH_KEY, tokens.refresh);
  localStorage.setItem(STORAGE_USERNAME_KEY, "Old name");
  fetchMock.mockResolvedValueOnce(Response.json(account));
  renderApp("/");
  expect(await screen.findByRole("heading", { name: "Ticket" })).toBeTruthy();
  expect(screen.getByText("Ticket User")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe(
    "/api/list_permission/",
  );
});

it("signs out and clears Ticket credentials, account information and cached data", async () => {
  mockSuccessfulLogin();
  renderApp();
  await submitLogin();
  await screen.findByRole("heading", { name: "Ticket" });
  queryClient.setQueryData(["private-data"], "cached");
  fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
  expect(
    await screen.findByRole("button", { name: "Sign In to Ticket" }),
  ).toBeTruthy();
  expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
  expect(getCookie(COOKIE_REFRESH_KEY)).toBeUndefined();
  expect(localStorage.getItem(STORAGE_USERNAME_KEY)).toBeNull();
  expect(localStorage.getItem(STORAGE_USER_PERMISSION_KEY)).toBeNull();
  expect(queryClient.getQueryData(["private-data"])).toBeUndefined();
});

it("does not reuse a Homepage session for the Ticket API", async () => {
  setCookie("_access_token_homepage", "homepage-access");
  renderApp();
  expect(
    await screen.findByRole("button", { name: "Sign In to Ticket" }),
  ).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(getCookie("_access_token_homepage")).toBe("homepage-access");
});
