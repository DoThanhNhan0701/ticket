import { Harness, expect } from "../harness";

export async function interviewState(h: Harness) {
  const p = h.page;
  let calendar = "",
    detail = "";
  await h.run(
    "recruitment",
    "/recruitment/interviews",
    "Calendar date/interviewer/view stored in search params",
    async () => {
      await h.nav("Lịch phỏng vấn");
      await p.locator("#recruitment-filter-from").fill("23/10/2026");
      await p.locator("#recruitment-filter-interviewer").fill("nhandt02");
      await p.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
      await p.getByRole("button", { name: "Tháng", exact: true }).click();
      await expect(p).toHaveURL(
        (url) =>
          url.searchParams.get("from_date") === "2026-10-23" &&
          url.searchParams.get("user_interview") === "nhandt02" &&
          url.searchParams.get("calendar_view") === "month",
      );
      calendar = p.url();
    },
  );
  await h.run(
    "recruitment",
    "/recruitment/interviews",
    "Explicit reload restores selected calendar date, interviewer and view",
    async () => {
      expect(calendar).not.toBe("");
      await p.reload(); // Reload persistence is the feature under test.
      await expect(
        p.getByRole("heading", { name: "Lịch phỏng vấn", exact: true }),
      ).toBeVisible();
      await expect(p.locator("#recruitment-filter-from")).toHaveValue(
        "23/10/2026",
      );
      await expect(p.locator("#recruitment-filter-interviewer")).toHaveValue(
        "nhandt02",
      );
      await expect(
        p.getByRole("button", { name: "Tháng", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(p.url()).toBe(calendar);
    },
    { allowDocument: true },
  );
  await h.run(
    "recruitment",
    "/recruitment/interviews/:codeInterview",
    "Open existing DATA CVs carrying calendar return context",
    async () => {
      await p.locator("#recruitment-filter-interviewer").fill("");
      await p.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
      await expect(p).toHaveURL(
        (url) => !url.searchParams.has("user_interview"),
      );
      calendar = p.url();
      await p
        .getByRole("button", {
          name: "Xem CV lịch Phỏng vấn DATA",
          exact: true,
        })
        .click();
      await expect(
        p.getByRole("table", { name: "CV phỏng vấn", exact: true }),
      ).toBeVisible();
      await expect(p).toHaveURL(
        (url) =>
          url.pathname.includes("/interviews/") &&
          url.searchParams.get("calendar_date") === "2026-10-23" &&
          url.searchParams.get("calendar_view") === "month",
      );
      detail = new URL(p.url()).pathname;
      h.visits.add("/recruitment/interviews/:codeInterview");
    },
  );
  await h.run(
    "recruitment",
    "/recruitment/interviews/:codeInterview",
    "Detail search, gender, status and page size stored in URL",
    async () => {
      expect(detail).not.toBe("");
      await p.locator("#interview-filter-search").fill("TEST_REC20_261021_18");
      await p
        .getByRole("button", { name: "Lọc nâng cao", exact: true })
        .click();
      await h.choose("Giới tính ứng viên", "Nữ", p.getByRole("dialog"));
      await p
        .getByRole("dialog")
        .getByRole("button", { name: "Áp dụng bộ lọc", exact: true })
        .click();
      await h.settle();
      await h.choose("Trạng thái ứng viên", "Đã nhận việc");
      await p.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
      await h.settle();
      await p
        .getByRole("combobox", { name: "Số ứng viên mỗi trang", exact: true })
        .click();
      await p.getByRole("option", { name: "200 / trang", exact: true }).click();
      await expect(p).toHaveURL(
        (url) =>
          url.searchParams.get("search") === "TEST_REC20_261021_18" &&
          url.searchParams.get("gender") === "Nữ" &&
          Boolean(url.searchParams.get("cv_status")) &&
          url.searchParams.get("page_size") === "200",
      );
    },
  );
  await h.run(
    "recruitment",
    "/recruitment/interviews/:codeInterview",
    "Explicit reload restores CV filters, page size and back destination",
    async () => {
      const url = p.url();
      await p.reload();
      await expect(p.locator("#interview-filter-search")).toHaveValue(
        "TEST_REC20_261021_18",
      );
      await expect(
        p.getByRole("combobox", { name: "Trạng thái ứng viên", exact: true }),
      ).toContainText("Đã nhận việc");
      await expect(
        p.getByRole("combobox", { name: "Số ứng viên mỗi trang", exact: true }),
      ).toContainText("200");
      await expect(
        p.getByRole("table", { name: "CV phỏng vấn", exact: true }),
      ).toBeVisible();
      expect(p.url()).toBe(url);
      await p
        .getByRole("button", { name: "Lọc nâng cao", exact: true })
        .click();
      await expect(
        p
          .getByRole("dialog")
          .getByRole("combobox", { name: "Giới tính ứng viên", exact: true }),
      ).toContainText("Nữ");
      await p.keyboard.press("Escape");
    },
    { allowDocument: true },
  );
  await h.run(
    "recruitment",
    "/recruitment/interviews",
    "Back button returns to exact calendar context after reload; browser Back restores filtered CV detail",
    async () => {
      await p
        .getByRole("button", { name: "Quay lại lịch phỏng vấn", exact: true })
        .click();
      await expect(p).toHaveURL(calendar);
      await expect(
        p.getByRole("button", { name: "Tháng", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await p.goBack();
      await expect(p).toHaveURL(
        (url) =>
          url.pathname === detail &&
          url.searchParams.get("page_size") === "200" &&
          url.searchParams.get("gender") === "Nữ",
      );
      await expect(p.locator("#interview-filter-search")).toHaveValue(
        "TEST_REC20_261021_18",
      );
      await p.setViewportSize({ width: 390, height: 844 });
      await expect(
        p.getByRole("button", { name: "Quay lại lịch phỏng vấn", exact: true }),
      ).toBeVisible();
      await p
        .getByRole("button", { name: "Quay lại lịch phỏng vấn", exact: true })
        .click();
      await expect(p).toHaveURL(calendar);
      await p.setViewportSize({ width: 1440, height: 900 });
    },
  );
}
