// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ErrorToast } from "@/components/error-toast";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
afterEach(cleanup);

it("shows an operation error as a toast without inserting an inline alert", () => {
  const { container, rerender } = render(<ErrorToast message="Lưu thất bại" />);
  expect(container.childElementCount).toBe(0);
  expect(toast.error).toHaveBeenCalledWith("Lưu thất bại", {
    id: expect.any(String),
  });
  rerender(<ErrorToast message="Lưu thất bại" />);
  expect(toast.error).toHaveBeenCalledOnce();
});

it("notifies again when an explicit retry fails with the same message", () => {
  const { rerender } = render(<ErrorToast message="Lưu thất bại" />);
  rerender(<></>);
  rerender(<ErrorToast message="Lưu thất bại" />);
  expect(toast.error).toHaveBeenCalledTimes(2);
});

it("uses one toast identity when React replays effects in Strict Mode", () => {
  render(
    <StrictMode>
      <ErrorToast message="Lưu thất bại" />
    </StrictMode>,
  );
  const calls = vi.mocked(toast.error).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  expect(new Set(calls.map(([, options]) => options?.id)).size).toBe(1);
});
