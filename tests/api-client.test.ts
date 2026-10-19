import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/api-error";
import { getApiBaseUrl } from "@/lib/api/api-base-url";
import {
  getRequest,
  postRequest,
  postWithSlashFallback,
} from "@/lib/api/client";
import { getCookie } from "@/lib/cookies";
import { clearAuthSession } from "@/lib/auth-session";
import { queryClient } from "@/lib/query-client";

vi.mock("@/lib/cookies", () => ({ getCookie: vi.fn() }));
vi.mock("@/lib/auth-session", () => ({ clearAuthSession: vi.fn() }));
vi.mock("@/lib/query-client", () => ({ queryClient: { clear: vi.fn() } }));
const fetchMock = vi.fn<typeof fetch>();
const jsonResponse = (data: unknown, status = 200) =>
  Response.json(data, { status });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {
    location: {
      origin: "https://portal.example",
      pathname: "/",
      href: "",
    },
  });
  vi.mocked(getCookie).mockReturnValue("test-token");
});

describe("HTTP client", () => {
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
