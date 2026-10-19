// @vitest-environment jsdom
import { lazy, Suspense } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "@/components/app-error-boundary";

afterEach(cleanup);

it("renders healthy routes normally", () => {
  render(
    <AppErrorBoundary>
      <h1>Danh sách yêu cầu</h1>
    </AppErrorBoundary>,
  );
  expect(
    screen.getByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Tải lại trang" })).toBeNull();
});

it("shows a recovery action instead of a blank page when a lazy route import fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const Page = lazy(() =>
    Promise.reject(
      new TypeError("Failed to fetch dynamically imported module"),
    ),
  );
  render(
    <AppErrorBoundary>
      <Suspense fallback={<p>Đang tải trang</p>}>
        <Page />
      </Suspense>
    </AppErrorBoundary>,
  );
  expect(
    await screen.findByRole("heading", { name: "Không tải được trang" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Tải lại trang" }).getAttribute("type"),
  ).toBe("button");
  expect(screen.queryByText("Đang tải trang")).toBeNull();
});
