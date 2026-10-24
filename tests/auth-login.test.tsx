// @vitest-environment jsdom
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import App from "@/app/app";
import { AuthProvider } from "@/features/auth/providers/auth-provider";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { clearAuthSession } from "@/lib/auth-session";
import { deleteCookie, getCookie, setCookie } from "@/lib/cookies";
import { queryClient } from "@/lib/query-client";
import { getRequest } from "@/lib/api/client";
import {
  COOKIE_REFRESH_KEY,
  COOKIE_TOKEN_KEY,
  STORAGE_USERNAME_KEY,
  STORAGE_USER_PERMISSION_KEY,
  STORAGE_AUTH_ENVIRONMENT_KEY,
} from "@/constants/auth";

const fetchMock = vi.fn<typeof fetch>();
beforeAll(async () => {
  // Transform the real lazy route outside DOM assertion deadlines.
  // Browser E2E still exercises the cold navigation and loading boundary.
  await import("@/pages/workspace");
});
vi.mock("@/features/requests/api/requests-api", () => ({
  listRequestsRequest: vi.fn().mockResolvedValue({ count: 0, results: [] }),
  listRequestStatusesRequest: vi.fn().mockResolvedValue([]),
  listAllRequestsRequest: vi.fn().mockResolvedValue({ count: 0, results: [] }),
  listRequestTypesRequest: vi.fn().mockResolvedValue([]),
}));
const tokens = { access: "ticket-access", refresh: "ticket-refresh" };
const account = {
  infoUser: [
    42,
    "Ticket User",
    "https://ticket-api.aiminds.io.vn/media/avatar.png",
  ],
  userPermission: ["can_create", "can_view", "can_accept", "can_report"],
  handlingPermission: { support: ["can_reply"] },
  is_handling: true,
  is_admin: false,
  is_superuser: false,
  can_assign: true,
  ls_permission: [],
  ls_department: [],
  ls_cv_status: [],
  ls_ticket_status: [],
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
  const { pathname } = useLocation();
  const { token, userId, avatarUrl, permissions } = useAuthContext();
  return (
    <output data-testid="account">
      {JSON.stringify({ token, userId, avatarUrl, permissions, pathname })}
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

  expect(
    await screen.findByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeTruthy();
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
  expect(details.pathname).toBe("/requests");
  expect(screen.queryByText("Bạn chưa có quyền truy cập")).toBeNull();
  expect(screen.queryByRole("link", { name: "Tổng quan" })).toBeNull();
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
  expect(
    screen.queryByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeNull();

  finishAccountRequest(Response.json(account));
  expect(
    await screen.findByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeTruthy();
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
  expect(
    await screen.findByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeTruthy();
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
    if (status === 401) {
      fetchMock.mockResolvedValueOnce(
        Response.json({ detail: "Account unavailable." }, { status: 401 }),
      );
    }
    renderApp();
    await submitLogin();
    if (status === 401)
      await screen.findByRole("heading", {
        name: "Bạn chưa có quyền truy cập",
      });
    else expect(await screen.findByText("Account unavailable.")).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Danh sách yêu cầu" }),
    ).toBeNull();
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

it.each([
  { handlingPermission: { IT: "can_reply" } },
  { ls_permission: [{ id: "1", name: "IT", team__name: "IT" }] },
  { ls_department: [{ id: 1, name: 123 }] },
  { is_handling: "true" },
  { infoUser: [42, "User", { url: "/avatar.png" }] },
])(
  "rejects malformed nested account fields without persisting a session: %j",
  async (invalid) => {
    fetchMock
      .mockResolvedValueOnce(Response.json(tokens))
      .mockResolvedValueOnce(Response.json({ ...account, ...invalid }));
    renderApp();
    await submitLogin();
    expect(
      await screen.findByText(
        "Invalid account information received from the server.",
      ),
    ).toBeTruthy();
    expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
    expect(getCookie(COOKIE_REFRESH_KEY)).toBeUndefined();
  },
);

it("restores a Ticket session and reloads account information", async () => {
  setCookie(COOKIE_TOKEN_KEY, tokens.access);
  setCookie(COOKIE_REFRESH_KEY, tokens.refresh);
  localStorage.setItem(STORAGE_USERNAME_KEY, "Old name");
  fetchMock.mockResolvedValueOnce(Response.json(account));
  renderApp("/");
  expect(
    await screen.findByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeTruthy();
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
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
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

it.each([
  "broken-json",
  { username: {}, userId: 42, permission: {} },
  { username: "User", userId: 42, permission: { can_system: "true" } },
])(
  "ignores corrupt cached account data when the account API is temporarily unavailable: %j",
  async (cached) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setCookie(COOKIE_TOKEN_KEY, tokens.access);
    localStorage.setItem(
      STORAGE_USERNAME_KEY,
      JSON.stringify({ invalid: true }),
    );
    localStorage.setItem(STORAGE_USER_PERMISSION_KEY, JSON.stringify(cached));
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderApp("/requests");
    expect(
      await screen.findByRole("heading", {
        name: "Bạn chưa có quyền truy cập",
      }),
    ).toBeTruthy();
    expect(getCookie(COOKIE_TOKEN_KEY)).toBe(tokens.access);
    expect(
      JSON.parse(screen.getByTestId("account").textContent ?? "{}").permissions,
    ).toBeNull();
  },
);

it("rejects a session created for another environment before making API calls", async () => {
  setCookie(COOKIE_TOKEN_KEY, tokens.access);
  setCookie(COOKIE_REFRESH_KEY, tokens.refresh);
  localStorage.setItem(
    STORAGE_AUTH_ENVIRONMENT_KEY,
    "production:https://other-api.example/api",
  );
  queryClient.setQueryData(["private-data"], "cached");
  renderApp("/requests");
  await screen.findByRole("heading", { name: "Bạn chưa có quyền truy cập" });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
  expect(queryClient.getQueryData(["private-data"])).toBeUndefined();
  expect(
    JSON.parse(screen.getByTestId("account").textContent ?? "{}").pathname,
  ).toBe("/forbidden");
  fireEvent.click(screen.getByRole("button", { name: "Đăng nhập lại" }));
  await screen.findByRole("button", { name: "Sign In to Ticket" });
});

it("redirects rejected account permissions to the denied page instead of using cached permissions", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  setCookie(COOKIE_TOKEN_KEY, tokens.access);
  localStorage.setItem(
    STORAGE_USER_PERMISSION_KEY,
    JSON.stringify({
      username: "Cached User",
      userId: 42,
      permission: { can_view: true },
    }),
  );
  fetchMock.mockResolvedValueOnce(
    new Response("", {
      status: 403,
      headers: { "Content-Type": "application/json" },
    }),
  );
  renderApp("/requests");
  await screen.findByRole("heading", { name: "Bạn chưa có quyền truy cập" });
  expect(
    screen.queryByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeNull();
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(
    JSON.parse(screen.getByTestId("account").textContent ?? "{}").pathname,
  ).toBe("/forbidden");
});

it("renders the denied page without a session or any API calls", async () => {
  renderApp("/forbidden");
  await screen.findByRole("heading", { name: "Bạn chưa có quyền truy cập" });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("shows denied access for the empty JSON 401/refresh response from the wrong API environment", async () => {
  setCookie(COOKIE_TOKEN_KEY, tokens.access);
  setCookie(COOKIE_REFRESH_KEY, tokens.refresh);
  for (let index = 0; index < 2; index++)
    fetchMock.mockResolvedValueOnce(
      new Response("", {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
  renderApp("/requests");
  await screen.findByRole("heading", { name: "Bạn chưa có quyền truy cập" });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
  expect(getCookie(COOKIE_REFRESH_KEY)).toBeUndefined();
});

it("discards cached permissions if the restored account response does not match this application", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  setCookie(COOKIE_TOKEN_KEY, tokens.access);
  localStorage.setItem(
    STORAGE_USER_PERMISSION_KEY,
    JSON.stringify({
      username: "Cached User",
      userId: 42,
      permission: { can_view: true },
    }),
  );
  fetchMock.mockResolvedValueOnce(Response.json({ other_app_user: 42 }));
  renderApp("/requests");
  await screen.findByRole("heading", { name: "Bạn chưa có quyền truy cập" });
  expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
  expect(localStorage.getItem(STORAGE_USER_PERMISSION_KEY)).toBeNull();
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("leaves the private workspace and clears its cache when a later API call loses permission", async () => {
  setCookie(COOKIE_TOKEN_KEY, tokens.access);
  fetchMock.mockResolvedValueOnce(Response.json(account));
  renderApp("/requests");
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
  queryClient.setQueryData(["private-data"], "cached");
  fetchMock.mockResolvedValueOnce(
    Response.json({ detail: "Forbidden" }, { status: 403 }),
  );
  await act(async () => {
    await expect(getRequest("/protected-resource/")).rejects.toMatchObject({
      status: 403,
    });
  });
  await screen.findByRole("heading", { name: "Bạn chưa có quyền truy cập" });
  expect(queryClient.getQueryData(["private-data"])).toBeUndefined();
  expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
  expect(
    screen.queryByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeNull();
});

it.each(["network", 500] as const)(
  "keeps the cached session when account restoration fails with %s",
  async (failure) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setCookie(COOKIE_TOKEN_KEY, tokens.access);
    setCookie(COOKIE_REFRESH_KEY, tokens.refresh);
    localStorage.setItem(STORAGE_USERNAME_KEY, "Cached User");
    localStorage.setItem(
      STORAGE_USER_PERMISSION_KEY,
      JSON.stringify({
        username: "Cached User",
        userId: 42,
        permission: { can_create: true, can_view: true },
      }),
    );
    queryClient.setQueryData(["private-data"], "cached");
    if (failure === "network") {
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    } else {
      fetchMock.mockResolvedValueOnce(
        Response.json(
          { detail: "Temporarily unavailable" },
          { status: failure },
        ),
      );
    }
    renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Danh sách yêu cầu" }),
    ).toBeTruthy();
    expect(screen.getByText("Cached User")).toBeTruthy();
    expect(getCookie(COOKIE_TOKEN_KEY)).toBe(tokens.access);
    expect(getCookie(COOKIE_REFRESH_KEY)).toBe(tokens.refresh);
    expect(queryClient.getQueryData(["private-data"])).toBe("cached");
    expect(
      screen.queryByRole("button", { name: "Sign In to Ticket" }),
    ).toBeNull();
  },
);

it("refreshes expired access during restoration and updates the provider token", async () => {
  setCookie(COOKIE_TOKEN_KEY, tokens.access);
  setCookie(COOKIE_REFRESH_KEY, tokens.refresh);
  fetchMock
    .mockResolvedValueOnce(
      Response.json({ code: "token_not_valid" }, { status: 401 }),
    )
    .mockResolvedValueOnce(
      Response.json({ access: "renewed-access", refresh: "renewed-refresh" }),
    )
    .mockResolvedValueOnce(Response.json(account));
  renderApp("/");
  expect(
    await screen.findByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeTruthy();
  expect(
    JSON.parse(screen.getByTestId("account").textContent ?? "{}").token,
  ).toBe("renewed-access");
  expect(getCookie(COOKIE_TOKEN_KEY)).toBe("renewed-access");
  expect(getCookie(COOKIE_REFRESH_KEY)).toBe("renewed-refresh");
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("restores with only a refresh cookie without showing the login form", async () => {
  setCookie(COOKIE_REFRESH_KEY, tokens.refresh);
  fetchMock
    .mockResolvedValueOnce(Response.json({ access: "renewed-access" }))
    .mockResolvedValueOnce(Response.json(account));
  renderApp("/");
  expect(
    await screen.findByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeTruthy();
  expect(screen.getByText("Ticket User")).toBeTruthy();
  expect(getCookie(COOKIE_TOKEN_KEY)).toBe("renewed-access");
  expect(getCookie(COOKIE_REFRESH_KEY)).toBe(tokens.refresh);
});

it("shows denied access when the stored refresh token is rejected", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  setCookie(COOKIE_TOKEN_KEY, tokens.access);
  setCookie(COOKIE_REFRESH_KEY, tokens.refresh);
  fetchMock
    .mockResolvedValueOnce(
      Response.json({ detail: "Expired" }, { status: 401 }),
    )
    .mockResolvedValueOnce(
      Response.json({ code: "token_not_valid" }, { status: 401 }),
    );
  renderApp("/");
  expect(
    await screen.findByRole("heading", { name: "Bạn chưa có quyền truy cập" }),
  ).toBeTruthy();
  expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
  expect(getCookie(COOKIE_REFRESH_KEY)).toBeUndefined();
  expect(localStorage.getItem(STORAGE_USER_PERMISSION_KEY)).toBeNull();
});

it("does not recreate the session when a refresh finishes after logout", async () => {
  setCookie(COOKIE_TOKEN_KEY, tokens.access);
  setCookie(COOKIE_REFRESH_KEY, tokens.refresh);
  let finishRefresh!: (response: Response) => void;
  fetchMock
    .mockResolvedValueOnce(Response.json(account))
    .mockResolvedValueOnce(
      Response.json({ detail: "Expired" }, { status: 401 }),
    )
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishRefresh = resolve;
        }),
    );
  renderApp("/");
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
  const outcome = expect(getRequest("/tickets/")).rejects.toMatchObject({
    status: 409,
  });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
  await act(async () => {
    finishRefresh(
      Response.json({ access: "late-access", refresh: "late-refresh" }),
    );
    await outcome;
  });
  expect(
    await screen.findByRole("button", { name: "Sign In to Ticket" }),
  ).toBeTruthy();
  expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
  expect(getCookie(COOKIE_REFRESH_KEY)).toBeUndefined();
});

it("replaces cached access with fresh revoked permissions before opening a page", async () => {
  setCookie(COOKIE_TOKEN_KEY, tokens.access);
  localStorage.setItem(
    STORAGE_USER_PERMISSION_KEY,
    JSON.stringify({
      username: "Cached admin",
      userId: 42,
      permission: { can_view: true, can_system: true },
    }),
  );
  let finish!: (response: Response) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  renderApp("/settings/users");
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  expect(screen.queryByRole("heading", { name: "Người dùng" })).toBeNull();
  await act(async () =>
    finish(
      Response.json({
        ...account,
        userPermission: [],
        handlingPermission: {},
        is_handling: false,
      }),
    ),
  );
  await screen.findByRole("heading", { name: "Bạn chưa có quyền truy cập" });
  expect(screen.queryByText("Cấu hình hệ thống")).toBeNull();
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(
    JSON.parse(localStorage.getItem(STORAGE_USER_PERMISSION_KEY) ?? "{}")
      .permission.can_system,
  ).toBeUndefined();
});

it.each(["getItem", "setItem", "removeItem"] as const)(
  "keeps login and logout usable when browser storage blocks %s",
  async (method) => {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    mockSuccessfulLogin();
    renderApp();
    await submitLogin();
    await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
    expect(getCookie(COOKIE_TOKEN_KEY)).toBe(tokens.access);
    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    await screen.findByRole("button", { name: "Sign In to Ticket" });
    expect(getCookie(COOKIE_TOKEN_KEY)).toBeUndefined();
  },
);
