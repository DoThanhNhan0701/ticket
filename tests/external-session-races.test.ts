import { beforeEach, expect, it, vi } from "vitest";
import { COOKIE_REFRESH_KEY, COOKIE_TOKEN_KEY } from "@/constants/auth";
const cookies = vi.hoisted(() => new Map<string, string>());
vi.mock("@/lib/cookies", () => ({
  getCookie: (key: string) => cookies.get(key),
  setCookie: (key: string, value: string) => cookies.set(key, value),
  deleteCookie: (key: string) => cookies.delete(key),
}));
vi.mock("@/lib/storage", () => ({
  deleteStorageItem: vi.fn(),
  setStorageItem: vi.fn(),
}));
vi.mock("@/lib/query-client", () => ({ queryClient: { clear: vi.fn() } }));
beforeEach(() => {
  vi.resetModules();
  cookies.clear();
  cookies.set(COOKIE_TOKEN_KEY, "old-access");
  cookies.set(COOKIE_REFRESH_KEY, "old-refresh");
  vi.stubGlobal("window", {
    location: {
      origin: "https://portal.example.test",
      pathname: "/",
      href: "",
    },
    dispatchEvent: vi.fn(),
  });
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});
it("never replays an old account mutation with new Homepage cookies before focus", async () => {
  let finish!: (response: Response) => void;
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetch);
  const { postRequest } = await import("@/lib/api/client");
  const pending = postRequest("/protected/", {
    body: { title: "Old account edit" },
  });
  cookies.set(COOKIE_TOKEN_KEY, "new-account-access");
  cookies.set(COOKIE_REFRESH_KEY, "new-account-refresh");
  finish(Response.json({ detail: "expired" }, { status: 401 }));
  await expect(pending).rejects.toMatchObject({ status: 409 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("rejects an old account successful response before focus", async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const { getRequest } = await import("@/lib/api/client");
  const pending = getRequest("/protected/");
  cookies.set(COOKIE_TOKEN_KEY, "new-account-access");
  cookies.set(COOKIE_REFRESH_KEY, "new-account-refresh");
  finish(Response.json({ username: "Old Account" }));
  await expect(pending).rejects.toMatchObject({ status: 409 });
});
it("does not overwrite a newly issued access cookie even if refresh is unchanged", async () => {
  cookies.delete(COOKIE_TOKEN_KEY);
  let finish!: (response: Response) => void;
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetch);
  const { getRequest } = await import("@/lib/api/client");
  const pending = getRequest("/protected/");
  cookies.set(COOKIE_TOKEN_KEY, "new-homepage-access");
  finish(Response.json({ access: "late-access", refresh: "late-refresh" }));
  await expect(pending).rejects.toMatchObject({ status: 409 });
  expect(cookies.get(COOKIE_TOKEN_KEY)).toBe("new-homepage-access");
  expect(cookies.get(COOKIE_REFRESH_KEY)).toBe("old-refresh");
});
it("does not clear new cookies when an old refresh fails", async () => {
  cookies.delete(COOKIE_TOKEN_KEY);
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const { getRequest } = await import("@/lib/api/client");
  const pending = getRequest("/protected/");
  cookies.set(COOKIE_TOKEN_KEY, "new-homepage-access");
  cookies.set(COOKIE_REFRESH_KEY, "new-homepage-refresh");
  finish(Response.json({ detail: "expired" }, { status: 401 }));
  await expect(pending).rejects.toMatchObject({ status: 409 });
  expect(cookies.get(COOKIE_TOKEN_KEY)).toBe("new-homepage-access");
});
