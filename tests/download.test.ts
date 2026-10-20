// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { downloadFile } from "@/lib/download";

afterEach(() => vi.useRealTimers());
it("starts a safe named download, removes its anchor and revokes its object URL", () => {
  vi.useFakeTimers();
  const create = vi.fn(() => "blob:report"),
    revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
  let filename = "";
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    filename = this.download;
    expect(this.href).toBe("blob:report");
    expect(document.body.contains(this)).toBe(true);
  });
  downloadFile(new Blob(["excel"]), "IT/Reports:October.xlsx");
  expect(filename).toBe("IT_Reports_October.xlsx");
  expect(document.querySelector("a")).toBeNull();
  expect(revoke).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1000);
  expect(revoke).toHaveBeenCalledWith("blob:report");
});
