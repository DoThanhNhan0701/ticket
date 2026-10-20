// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReportCharts } from "@/features/reports/components/report-charts";
import {
  largeReportFixture,
  emptyReportFixture,
  reportFixture,
} from "./fixtures/reports";

type Observed = {
  callback: ResizeObserverCallback;
  target: Element | null;
  disconnect: ReturnType<typeof vi.fn>;
};
let observed: Observed[];
beforeEach(() => {
  observed = [];
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function (callback: ResizeObserverCallback) {
      const entry: Observed = { callback, target: null, disconnect: vi.fn() };
      observed.push(entry);
      return {
        observe: (target: Element) => {
          entry.target = target;
        },
        unobserve: vi.fn(),
        disconnect: entry.disconnect,
      };
    }),
  );
});
afterEach(cleanup);
function resize(width: number) {
  act(() => {
    for (const entry of observed)
      entry.callback(
        [
          {
            contentRect: { width },
            target: entry.target,
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
  });
}
it("adapts dense rates to narrow containers while preserving all labels, counts and percentages", () => {
  render(<ReportCharts report={largeReportFixture} />);
  resize(262);
  const handlers = screen.getByRole("img", {
    name: "Tỷ lệ yêu cầu đúng thời hạn",
  });
  const types = screen.getByRole("img", { name: "Tỷ lệ loại yêu cầu" });
  expect(handlers.querySelector("svg")).toBeNull();
  expect(handlers.querySelectorAll("li")).toHaveLength(12);
  expect(types.querySelectorAll("li")).toHaveLength(6);
  expect(handlers.textContent).toContain("0/110%");
  expect(handlers.textContent).toContain("11/11100%");
  for (const label of Object.keys(largeReportFixture.dict_bieudo_04))
    expect(types.querySelector(`[title="${label}"]`)).not.toBeNull();
  expect(
    document.getElementById(types.getAttribute("aria-describedby")!)
      ?.textContent,
  ).toContain("148/359 (41,2%)");
});
it("resizes desktop plots to the full container and retains readable HTML labels", () => {
  render(<ReportCharts report={largeReportFixture} />);
  resize(1100);
  const handlers = screen.getByRole("img", {
    name: "Tỷ lệ yêu cầu đúng thời hạn",
  });
  const types = screen.getByRole("img", { name: "Tỷ lệ loại yêu cầu" });
  expect(handlers.querySelector("svg")?.getAttribute("viewBox")).toBe(
    "0 0 1100 240",
  );
  expect(handlers.querySelectorAll("rect")).toHaveLength(12);
  expect(types.querySelectorAll("circle")).toHaveLength(6);
  expect(types.querySelector("polyline")).not.toBeNull();
  expect(types.textContent).toContain(
    "Cấp mới hoặc thu hồi quyền sử dụng tài sản cá nhân",
  );
  resize(390);
  expect(handlers.querySelector("svg")).toBeNull();
  expect(types.querySelector("svg")).toBeNull();
});
it("gives every displayed share a distinct color and exposes its exact count", () => {
  render(<ReportCharts report={largeReportFixture} />);
  const share = screen.getByRole("img", { name: "Tỷ lệ đảm nhận: 91 yêu cầu" });
  const legend = share.parentElement!.querySelector("ul")!;
  const items = Array.from(legend.querySelectorAll("li"));
  expect(items).toHaveLength(13);
  expect(
    new Set(
      items.map((item) => item.querySelector("span")?.style.backgroundColor),
    ).size,
  ).toBe(13);
  expect(items[12].title).toBe("Handler13: 13 (14,3%)");
  expect(items[12].textContent).toContain("1314,3%");
});
it("disconnects resize observers on unmount and renders empty datasets without plots", () => {
  const view = render(<ReportCharts report={reportFixture} />);
  view.unmount();
  expect(observed).toHaveLength(2);
  for (const entry of observed) expect(entry.disconnect).toHaveBeenCalledOnce();
  observed = [];
  render(<ReportCharts report={emptyReportFixture} />);
  expect(screen.getByText("Chưa có dữ liệu đảm nhận")).toBeTruthy();
  expect(screen.getAllByText("Chưa có dữ liệu tỷ lệ")).toHaveLength(2);
  expect(observed).toHaveLength(0);
});
