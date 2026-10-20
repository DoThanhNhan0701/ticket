import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/api-error";
import { getApiBaseUrl } from "@/lib/api/api-base-url";
import {
  getRequest,
  postRequest,
  postWithSlashFallback,
} from "@/lib/api/client";
import { getCookie } from "@/lib/cookies";
import {
  clearAuthSession,
  getAuthSessionVersion,
  updateAuthTokens,
} from "@/lib/auth-session";
import { COOKIE_TOKEN_KEY, COOKIE_REFRESH_KEY } from "@/constants/auth";
import { queryClient } from "@/lib/query-client";

vi.mock("@/lib/cookies", () => ({ getCookie: vi.fn() }));
vi.mock("@/lib/auth-session", () => ({
  clearAuthSession: vi.fn(),
  getAuthSessionVersion: vi.fn(),
  updateAuthTokens: vi.fn(),
}));
vi.mock("@/lib/query-client", () => ({ queryClient: { clear: vi.fn() } }));
const fetchMock = vi.fn<typeof fetch>();
const storedCookies = new Map<string, string>();
let sessionVersion = 0;
const jsonResponse = (data: unknown, status = 200) =>
  Response.json(data, { status });

beforeEach(() => {
  fetchMock.mockReset();
  storedCookies.clear();
  storedCookies.set(COOKIE_TOKEN_KEY, "test-token");
  sessionVersion += 1;
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {
    location: {
      origin: "https://portal.example",
      pathname: "/",
      href: "",
    },
  });
  vi.mocked(getCookie).mockImplementation((key) => storedCookies.get(key));
  vi.mocked(getAuthSessionVersion).mockImplementation(() => sessionVersion);
  vi.mocked(clearAuthSession).mockImplementation(() => {
    sessionVersion += 1;
    storedCookies.clear();
  });
  vi.mocked(updateAuthTokens).mockImplementation((tokens, version) => {
    if (version !== sessionVersion) return false;
    storedCookies.set(COOKIE_TOKEN_KEY, tokens.access);
    if (tokens.refresh) storedCookies.set(COOKIE_REFRESH_KEY, tokens.refresh);
    return true;
  });
});

describe("session recovery", () => {
  it.each([undefined, "rotated-refresh"])(
    "refreshes an expired token and retries a POST while preserving its body and signal (%s)",
    async (rotated) => {
      storedCookies.set(COOKIE_REFRESH_KEY, "test-refresh");
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ code: "token_not_valid" }, 401))
        .mockResolvedValueOnce(
          jsonResponse({
            access: "new-access",
            ...(rotated ? { refresh: rotated } : {}),
          }),
        )
        .mockResolvedValueOnce(jsonResponse({ saved: true }));
      const controller = new AbortController();
      await expect(
        postRequest("/tickets/", {
          body: { title: "Support request" },
          signal: controller.signal,
        }),
      ).resolves.toEqual({ saved: true });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const [refreshUrl, refreshOptions] = fetchMock.mock.calls[1];
      expect(new URL(String(refreshUrl)).pathname).toBe("/api/token/refresh/");
      expect(refreshOptions?.method).toBe("POST");
      expect(JSON.parse(String(refreshOptions?.body))).toEqual({
        refresh: "test-refresh",
      });
      expect(new Headers(refreshOptions?.headers).has("Authorization")).toBe(
        false,
      );
      const [, retryOptions] = fetchMock.mock.calls[2];
      expect(retryOptions?.body).toBe(fetchMock.mock.calls[0][1]?.body);
      expect(retryOptions?.signal).toBe(controller.signal);
      expect(new Headers(retryOptions?.headers).get("Authorization")).toBe(
        "Bearer new-access",
      );
      expect(storedCookies.get(COOKIE_REFRESH_KEY)).toBe(
        rotated ?? "test-refresh",
      );
      expect(clearAuthSession).not.toHaveBeenCalled();
    },
  );

  it("shares a single refresh between simultaneous expired requests", async () => {
    storedCookies.set(COOKIE_REFRESH_KEY, "test-refresh");
    let finishRefresh!: (response: Response) => void;
    const pendingRefresh = new Promise<Response>((resolve) => {
      finishRefresh = resolve;
    });
    fetchMock.mockImplementation(async (url, options) => {
      if (String(url).endsWith("/token/refresh/")) return pendingRefresh;
      if (
        new Headers(options?.headers).get("Authorization") ===
        "Bearer test-token"
      ) {
        return jsonResponse({ detail: "Expired" }, 401);
      }
      return jsonResponse({ ok: true });
    });
    const requests = Promise.all([
      getRequest("/tickets/"),
      getRequest("/list_permission/"),
    ]);
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          String(url).endsWith("/token/refresh/"),
        ),
      ).toHaveLength(1),
    );
    finishRefresh(jsonResponse({ access: "new-access" }));
    await expect(requests).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(clearAuthSession).not.toHaveBeenCalled();
  });

  it("reuses a token already refreshed by another request when an old 401 arrives late", async () => {
    storedCookies.set(COOKIE_REFRESH_KEY, "test-refresh");
    let finishOldRequest!: (response: Response) => void;
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishOldRequest = resolve;
          }),
      )
      .mockResolvedValueOnce(jsonResponse({ detail: "Expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ access: "new-access" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const lateRequest = getRequest("/tickets/late/");
    await getRequest("/tickets/first/");
    finishOldRequest(jsonResponse({ detail: "Expired" }, 401));
    await expect(lateRequest).resolves.toEqual({ ok: true });
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith("/token/refresh/"),
      ),
    ).toHaveLength(1);
  });

  it.each([403, 500])(
    "keeps the session on a regular %i, even when the error mentions a token",
    async (status) => {
      storedCookies.set(COOKIE_REFRESH_KEY, "test-refresh");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ detail: "You cannot manage token settings." }, status),
      );
      await expect(getRequest("/settings/")).rejects.toMatchObject({ status });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(clearAuthSession).not.toHaveBeenCalled();
      expect(queryClient.clear).not.toHaveBeenCalled();
      expect(window.location.href).toBe("");
    },
  );

  it.each([429, 500, 503])(
    "keeps tokens when the refresh service returns %i",
    async (status) => {
      storedCookies.set(COOKIE_REFRESH_KEY, "test-refresh");
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ detail: "Expired" }, 401))
        .mockResolvedValueOnce(
          jsonResponse({ detail: "Token service unavailable" }, status),
        );
      await expect(getRequest("/tickets/")).rejects.toMatchObject({ status });
      expect(storedCookies.get(COOKIE_TOKEN_KEY)).toBe("test-token");
      expect(storedCookies.get(COOKIE_REFRESH_KEY)).toBe("test-refresh");
      expect(clearAuthSession).not.toHaveBeenCalled();
      expect(window.location.href).toBe("");
    },
  );

  it("retains the session after a network error and permits a later refresh attempt", async () => {
    storedCookies.set(COOKIE_REFRESH_KEY, "test-refresh");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: "Expired" }, 401))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ detail: "Expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ access: "new-access" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(getRequest("/tickets/")).rejects.toThrow("Failed to fetch");
    expect(clearAuthSession).not.toHaveBeenCalled();
    await expect(getRequest("/tickets/")).resolves.toEqual({ ok: true });
  });

  it.each([401, 403])(
    "signs out when the refresh token is rejected with %i",
    async (status) => {
      storedCookies.set(COOKIE_REFRESH_KEY, "test-refresh");
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ detail: "Expired" }, 401))
        .mockResolvedValueOnce(
          jsonResponse({ detail: "Refresh token invalid" }, status),
        );
      await expect(getRequest("/tickets/")).rejects.toMatchObject({ status });
      expect(clearAuthSession).toHaveBeenCalledOnce();
      expect(queryClient.clear).toHaveBeenCalledOnce();
      expect(window.location.href).toBe("/login");
    },
  );

  it("retries only once if the refreshed access token is also rejected", async () => {
    storedCookies.set(COOKIE_REFRESH_KEY, "test-refresh");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: "Expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ access: "new-access" }))
      .mockResolvedValueOnce(jsonResponse({ detail: "Invalid access" }, 401));
    await expect(getRequest("/tickets/")).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(clearAuthSession).toHaveBeenCalledOnce();
  });

  it("recovers with the refresh token when the access cookie is missing", async () => {
    storedCookies.delete(COOKIE_TOKEN_KEY);
    storedCookies.set(COOKIE_REFRESH_KEY, "test-refresh");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access: "new-access" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(getRequest("/tickets/")).resolves.toEqual({ ok: true });
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe(
      "/api/token/refresh/",
    );
    expect(clearAuthSession).not.toHaveBeenCalled();
  });

  it("ignores a refresh response received after the user signs out", async () => {
    storedCookies.set(COOKIE_REFRESH_KEY, "test-refresh");
    let finishRefresh!: (response: Response) => void;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: "Expired" }, 401))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishRefresh = resolve;
          }),
      );
    const request = getRequest("/tickets/");
    const outcome = expect(request).rejects.toMatchObject({ status: 409 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    clearAuthSession();
    finishRefresh(
      jsonResponse({ access: "late-access", refresh: "late-refresh" }),
    );
    await outcome;
    expect(updateAuthTokens).not.toHaveBeenCalled();
    expect(storedCookies.size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("HTTP client", () => {
  it("preserves multipart fields and reads a binary response without setting a JSON content type", async () => {
    const body = new FormData();
    body.append("handlinggroup", "3");
    fetchMock.mockResolvedValueOnce(
      new Response(
        new Blob(["spreadsheet"], { type: "application/vnd.ms-excel" }),
      ),
    );
    const blob = await postRequest<Blob>("/export_excel", {
      body,
      responseType: "blob",
    });
    expect(await blob.text()).toBe("spreadsheet");
    expect(fetchMock.mock.calls[0][1]?.body).toBe(body);
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).has("Content-Type"),
    ).toBe(false);
  });

  it("refreshes an expired binary export request using the same multipart body", async () => {
    storedCookies.set(COOKIE_REFRESH_KEY, "refresh");
    const body = new FormData();
    body.append("ticket_type_id", "All");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: "token_not_valid" }, 401))
      .mockResolvedValueOnce(jsonResponse({ access: "fresh-export-access" }))
      .mockResolvedValueOnce(
        new Response(new Blob(["excel"], { type: "application/vnd.ms-excel" })),
      );
    const file = await postRequest<Blob>("/export_ticket_type", {
      body,
      responseType: "blob",
    });
    expect(await file.text()).toBe("excel");
    expect(fetchMock.mock.calls[0][1]?.body).toBe(body);
    expect(fetchMock.mock.calls[2][1]?.body).toBe(body);
    expect(
      new Headers(fetchMock.mock.calls[2][1]?.headers).get("Authorization"),
    ).toBe("Bearer fresh-export-access");
    expect(
      new Headers(fetchMock.mock.calls[2][1]?.headers).has("Content-Type"),
    ).toBe(false);
  });

  it("keeps JSON no-data responses available to binary export callers", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 0 }));
    await expect(
      postRequest("/export_ticket_type", { responseType: "blob" }),
    ).resolves.toEqual({ status: 0 });
  });

  it("rejects a binary response received after signing out", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = postRequest("/export_excel", { responseType: "blob" });
    const rejected = expect(pending).rejects.toMatchObject({ status: 409 });
    clearAuthSession();
    finish(
      new Response(
        new Blob(["old account data"], { type: "application/vnd.ms-excel" }),
      ),
    );
    await rejected;
  });
  it.each([
    [undefined, "/api"],
    ["", "/api"],
    ["   ", "/api"],
    ["/", "/api"],
    ["/api", "/api"],
    [" /api/ ", "/api"],
    [
      "https://ticket-api.aiminds.io.vn",
      "https://ticket-api.aiminds.io.vn/api",
    ],
    ["http://192.168.30.69:8002", "http://192.168.30.69:8002/api"],
    ["http://192.168.30.69:8002/", "http://192.168.30.69:8002/api"],
    ["http://192.168.30.69:8002/api", "http://192.168.30.69:8002/api"],
    ["http://192.168.30.69:8002/api/", "http://192.168.30.69:8002/api"],
  ])("normalizes API base %j to %s", (configuredUrl, expected) => {
    const baseUrl = getApiBaseUrl(configuredUrl);
    expect(baseUrl).toBe(expected);
    for (const endpoint of [
      "/token/",
      "/list_permission/",
      "/list-user/",
      "/list-project",
      "/user-manager/7",
      "/reset-pass/",
    ]) {
      expect(
        new URL(`${baseUrl}${endpoint}`, "https://portal.example").pathname,
      ).toBe(`/api${endpoint}`);
    }
  });

  it("encodes parameters, attaches credentials and forwards cancellation", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ count: 0 }));
    const controller = new AbortController();
    await expect(
      getRequest("/list-user/", {
        params: { search: "a & b" },
        signal: controller.signal,
      }),
    ).resolves.toEqual({ count: 0 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://portal.example/api/list-user/?search=a+%26+b",
    );
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer test-token",
    );
    expect(options?.signal).toBe(controller.signal);
  });
  it("supports an empty response", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(
      postRequest("/tickets/7/", { body: { status: "closed" } }),
    ).resolves.toBeNull();
  });
  it("retains status even when a JSON 404 message does not contain 404", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: "Not found." }, 404),
    );
    await expect(postRequest("/missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Not found.",
    });
  });
  it("only falls back to the alternate URL on an actual 404", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: "Not found." }, 404))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(
      postWithSlashFallback("/reset-pass/", { body: { user_id: 7 } }),
    ).resolves.toEqual({ ok: true });
    expect(
      fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname),
    ).toEqual(["/api/reset-pass/", "/api/reset-pass"]);
  });
  it("does not retry validation errors mentioning 404", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "User 404 is invalid" }, 400),
    );
    await expect(
      postWithSlashFallback("/reset-pass/", {}),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("clears session and cache when an authenticated request expires", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Expired" }, 401));
    await expect(getRequest("/list-user/")).rejects.toMatchObject({
      status: 401,
    });
    expect(clearAuthSession).toHaveBeenCalledOnce();
    expect(queryClient.clear).toHaveBeenCalledOnce();
    expect(window.location.href).toBe("/login");
  });
  it("leaves public login failures available to the login form", async () => {
    vi.mocked(getCookie).mockReturnValue(undefined);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: "Bad credentials" }, 401),
    );
    await expect(postRequest("/token/")).rejects.toThrow("Bad credentials");
    expect(clearAuthSession).not.toHaveBeenCalled();
  });
  it("does not send an existing bearer token when requesting login tokens", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access: "new-access", refresh: "new-refresh" }),
    );
    await postRequest("/token/", {
      body: { username: "user", password: "password" },
    });
    const [, options] = fetchMock.mock.calls[0];
    expect(new Headers(options?.headers).has("Authorization")).toBe(false);
  });
  it("rejects missing credentials before making a protected request", async () => {
    vi.mocked(getCookie).mockReturnValue(undefined);
    await expect(getRequest("/list-user/")).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("preserves non-JSON error status for fallback decisions", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("upstream unavailable", { status: 503 }),
    );
    await expect(getRequest("/list-user/")).rejects.toMatchObject({
      status: 503,
      message: "HTTP Error! Status: 503",
    });
  });
});
