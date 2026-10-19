// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import {
  deleteStorageItem,
  getStorageItem,
  setStorageItem,
} from "@/lib/storage";

beforeEach(() => localStorage.clear());

it("round-trips account objects and retains legacy unquoted usernames", () => {
  const account = { username: "ticket.user", permission: { can_create: true } };
  setStorageItem("account", account);
  expect(getStorageItem("account")).toEqual(account);
  setStorageItem("username", "ticket.user");
  expect(getStorageItem("username")).toBe("ticket.user");
  setStorageItem("empty", "");
  expect(localStorage.getItem("empty")).toBe("");
  deleteStorageItem("account");
  expect(getStorageItem("account")).toBeNull();
});

it.each([
  undefined,
  Symbol("invalid"),
  () => undefined,
  { toJSON: () => undefined },
])(
  "rejects values JSON cannot serialize without overwriting existing storage: %s",
  (value) => {
    setStorageItem("account", "previous");
    expect(() => setStorageItem("account", value)).toThrow(TypeError);
    expect(localStorage.getItem("account")).toBe("previous");
  },
);
