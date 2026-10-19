// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import Cookies from "js-cookie";
import { setCookie } from "@/lib/cookies";

vi.mock("js-cookie", () => ({ default: { set: vi.fn() } }));

it.each([
  ["https:", true],
  ["http:", false],
] as const)(
  "sets the Secure cookie flag appropriately for %s",
  (protocol, secure) => {
    vi.stubGlobal("window", { location: { protocol } });
    setCookie("_access_token_ticket", "test-access");
    expect(Cookies.set).toHaveBeenCalledWith(
      "_access_token_ticket",
      "test-access",
      {
        expires: 7,
        path: "/",
        sameSite: "Lax",
        secure,
      },
    );
  },
);
