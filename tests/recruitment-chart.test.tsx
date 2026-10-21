// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { RecruitmentChart } from "@/features/recruitment/components/recruitment-chart";

afterEach(cleanup);

it("plots recruitment duration rather than hired CV counts in the duration report", () => {
  render(
    <RecruitmentChart
      section="result_time_recruitment"
      rows={[{ rec_position: "Developer", rate_pass: 12, number_cv_pass: 2 }]}
    />,
  );
  expect(
    screen.getByRole("figure", { name: "Biểu đồ thời gian tuyển dụng" }),
  ).toBeTruthy();
  expect(screen.getByText("12")).toBeTruthy();
  expect(screen.queryByText("2")).toBeNull();
});

it("keeps chart widths finite for invalid numeric data and zero-only reports", () => {
  const { container } = render(
    <RecruitmentChart
      rows={[
        { name: "Missing", number_cv: "invalid" },
        { name: "Infinite", number_cv: Infinity },
        { name: "Negative", number_cv: -1 },
        { name: "Zero", number_cv: 0 },
      ]}
    />,
  );
  expect(screen.getAllByText("0")).toHaveLength(4);
  for (const bar of container.querySelectorAll<HTMLElement>(
    ".recruitment-chart-bar",
  ))
    expect(bar.style.width).toBe("0%");
});

it("distinguishes monthly department categories using their month", () => {
  render(
    <RecruitmentChart
      section="result_department_month"
      rows={[
        { department_recruited: "HR", month: "2026-09", number_cv_all: 5 },
        { department_recruited: "HR", month: "2026-10", number_cv_all: 3 },
      ]}
    />,
  );
  expect(screen.getByText("HR · 2026-09")).toBeTruthy();
  expect(screen.getByText("HR · 2026-10")).toBeTruthy();
});
