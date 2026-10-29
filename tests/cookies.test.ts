// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://ticket.aiminds.io.vn"}
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Cookies from "js-cookie";
import { deleteCookie, getCookie, setCookie } from "@/lib/cookies";

const tokenNames = ["rainscales_ticket_access", "rainscales_ticket_refresh"];

beforeEach(() => {
  vi.stubEnv("VITE_COOKIE_DOMAIN", ".aiminds.io.vn");
  for (const name of tokenNames) {
    Cookies.remove(name, { path: "/" });
    Cookies.remove(name, { path: "/", domain: "ticket.aiminds.io.vn" });
    Cookies.remove(name, { path: "/", domain: "aiminds.io.vn" });
  }
});

afterEach(() => vi.unstubAllEnvs());

it("selects the matching shared domain in a production build served on Aiminds", () => {
  vi.stubEnv("VITE_COOKIE_DOMAIN", ".rainscales.com.vn, .aiminds.io.vn");
  Cookies.set(tokenNames[0], "stale-host", { path: "/" });
  Cookies.set(tokenNames[0], "homepage-session", {
    path: "/",
    domain: "aiminds.io.vn",
  });
  expect(getCookie(tokenNames[0])).toBe("homepage-session");
  setCookie(tokenNames[0], "refreshed-session");
  expect(Cookies.get(tokenNames[0])).toBe("refreshed-session");
  expect(
    document.cookie
      .split("; ")
      .filter((cookie) => cookie.startsWith(`${tokenNames[0]}=`)),
  ).toHaveLength(1);
  deleteCookie(tokenNames[0]);
  expect(Cookies.get(tokenNames[0])).toBeUndefined();
});

it("selects Rainscales when both production domains are configured", () => {
  vi.stubEnv("VITE_COOKIE_DOMAIN", ".rainscales.com.vn,.aiminds.io.vn");
  vi.stubGlobal("window", {
    location: { hostname: "ticket.rainscales.com.vn", protocol: "https:" },
  });
  const set = vi.spyOn(Cookies, "set");
  setCookie(tokenNames[0], "production-session");
  expect(set).toHaveBeenLastCalledWith(
    tokenNames[0],
    "production-session",
    expect.objectContaining({ domain: "rainscales.com.vn" }),
  );
});

it.each(["", undefined])(
  "keeps cookies host-only when domain is %s",
  (domain) => {
    vi.stubEnv("VITE_COOKIE_DOMAIN", domain);
    const set = vi.spyOn(Cookies, "set");
    setCookie(tokenNames[0], "host-session");
    expect(set).toHaveBeenLastCalledWith(
      tokenNames[0],
      "host-session",
      expect.not.objectContaining({ domain: expect.anything() }),
    );
  },
);

it("uses the configured domain instead of a fixed domain", () => {
  vi.stubEnv("VITE_COOKIE_DOMAIN", " .EXAMPLE.COM ");
  vi.stubGlobal("window", {
    location: { hostname: "ticket.example.com", protocol: "https:" },
  });
  const set = vi.spyOn(Cookies, "set");
  setCookie(tokenNames[0], "configured-session");
  expect(set).toHaveBeenLastCalledWith(
    tokenNames[0],
    "configured-session",
    expect.objectContaining({ domain: "example.com", path: "/" }),
  );
});

it.each([
  ["https:", true],
  ["http:", false],
] as const)(
  "sets the Secure cookie flag appropriately for %s",
  (protocol, secure) => {
    vi.stubGlobal("window", { location: { protocol, hostname: "localhost" } });
    const set = vi.spyOn(Cookies, "set");
    setCookie(tokenNames[0], "test-access");
    expect(set).toHaveBeenCalledWith(tokenNames[0], "test-access", {
      expires: 7,
      path: "/",
      sameSite: "Lax",
      secure,
    });
  },
);

it.each(["ticket.aiminds.io.vn", "ticket-new.aiminds.io.vn", "aiminds.io.vn"])(
  "uses the shared domain on %s",
  (hostname) => {
    vi.stubGlobal("window", { location: { hostname, protocol: "https:" } });
    const set = vi.spyOn(Cookies, "set");
    setCookie(tokenNames[0], "shared-session");
    expect(set).toHaveBeenLastCalledWith(
      tokenNames[0],
      "shared-session",
      expect.objectContaining({ domain: "aiminds.io.vn", path: "/" }),
    );
    expect(getCookie(tokenNames[0])).toBe("shared-session");
  },
);

it.each(tokenNames)(
  "writes %s to the shared domain and removes legacy scopes",
  (name) => {
    Cookies.set(name, "old-host", { path: "/" });
    Cookies.set(name, "old-domain", {
      path: "/",
      domain: "ticket.aiminds.io.vn",
    });
    const set = vi.spyOn(Cookies, "set");

    setCookie(name, "new-token", 3);

    expect(set).toHaveBeenLastCalledWith(name, "new-token", {
      expires: 3,
      path: "/",
      sameSite: "Lax",
      secure: true,
      domain: "aiminds.io.vn",
    });
    expect(Cookies.get(name)).toBe("new-token");
    expect(
      document.cookie
        .split("; ")
        .filter((cookie) => cookie.startsWith(`${name}=`)),
    ).toHaveLength(1);
    Cookies.remove(name, { path: "/", domain: "aiminds.io.vn" });
    expect(Cookies.get(name)).toBeUndefined();
  },
);

it.each(tokenNames)(
  "prefers the shared %s before the first API request",
  (name) => {
    Cookies.set(name, "stale-ticket", { path: "/" });
    Cookies.set(name, "homepage-token", {
      path: "/",
      domain: ".aiminds.io.vn",
    });

    expect(getCookie(name)).toBe("homepage-token");
    expect(getCookie(name)).toBe("homepage-token");
    Cookies.remove(name, { path: "/", domain: "aiminds.io.vn" });
    expect(Cookies.get(name)).toBeUndefined();
  },
);

it.each(tokenNames)(
  "preserves a legacy-only %s by moving it to the shared domain",
  (name) => {
    Cookies.set(name, "existing-session", { path: "/" });

    expect(getCookie(name)).toBe("existing-session");
    Cookies.remove(name, { path: "/", domain: "aiminds.io.vn" });
    expect(Cookies.get(name)).toBeUndefined();
  },
);

it.each(tokenNames)("deletes every scope of %s on logout", (name) => {
  Cookies.set(name, "host", { path: "/" });
  Cookies.set(name, "ticket-domain", {
    path: "/",
    domain: "ticket.aiminds.io.vn",
  });
  Cookies.set(name, "shared", { path: "/", domain: "aiminds.io.vn" });

  deleteCookie(name);

  expect(Cookies.get(name)).toBeUndefined();
  expect(getCookie(name)).toBeUndefined();
});

it.each([
  "localhost",
  "127.0.0.1",
  "ticket.rainscales.com.vn",
  "fakeaiminds.io.vn",
])("keeps cookies host-only on %s", (hostname) => {
  vi.stubGlobal("window", { location: { hostname, protocol: "https:" } });
  const set = vi.spyOn(Cookies, "set");
  setCookie(tokenNames[0], "local-session");
  expect(set).toHaveBeenLastCalledWith(tokenNames[0], "local-session", {
    expires: 7,
    path: "/",
    sameSite: "Lax",
    secure: true,
  });
});
