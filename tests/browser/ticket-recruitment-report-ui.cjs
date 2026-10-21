// Isolated browser review: every API response is a fixture; no backend writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:5198";
const output =
  process.env.SCREENSHOT_DIR || "/tmp/ticket-recruitment-report-ui";
const rows = Array.from({ length: 101 }, (_, index) => ({
  id: index + 1,
  rec_position: `Chuyên viên phát triển sản phẩm và vận hành ${index + 1}`,
  ticket_code: `HR_261021_${index + 1}`,
  department_recruited: "Khối công nghệ và phát triển sản phẩm",
  quantity: 3,
  number_cv_all: index % 5,
  number_cv_pass: index % 2,
  rate_pass: index % 4,
}));
const report = {
  result_rect: rows,
  result_department: rows.slice(0, 12),
  result_hr: rows.slice(0, 12).map((row) => ({
    ...row,
    rec_position: undefined,
    username: `Người phụ trách ${row.id}`,
  })),
  result_time_recruitment: rows.slice(0, 12),
  result_candidate_source: [
    {
      candidate_source__name: "Giới thiệu nội bộ",
      number_cv_all: 28,
      number_cv_pass: 4,
    },
  ],
  result_cv_conversion_rate: [
    { name: "Ứng tuyển", number_cv: 100, rate: 100 },
    { name: "Phỏng vấn", number_cv: 36, rate: 36 },
    { name: "Nhận việc", number_cv: 8, rate: 8 },
  ],
  result_cv_status: { 1: [10], 2: [4] },
  result_department_month: [
    {
      month: "2026-10",
      department_recruited: "Khối công nghệ",
      number_cv_all: 16,
      quantity: 3,
      number_cv_pass: 2,
    },
  ],
};

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  const checks = [];
  let reportRequests = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) =>
    console.error(request.url(), request.failure()?.errorText),
  );
  await context.addCookies([
    { name: "_access_token_ticket", value: "report-layout-fixture", url: base },
  ]);
  await context.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    assert.equal(
      route.request().method(),
      "GET",
      "fixture review must be read-only",
    );
    if (path === "/api/list_permission/")
      return route.fulfill({
        json: {
          infoUser: [42, "Reviewer", null],
          userPermission: ["can_hr_rec"],
          handlingPermission: {},
          is_handling: false,
          is_superuser: false,
          ls_permission: [],
          ls_department: [],
          ls_cv_status: [],
          ls_ticket_status: [],
        },
      });
    if (path === "/api/report_rect/") {
      reportRequests += 1;
      return route.fulfill({ json: report });
    }
    if (path === "/api/list_status_cv/")
      return route.fulfill({
        json: [
          { id: 1, name: "Mới" },
          { id: 2, name: "Đã nhận việc" },
        ],
      });
    return route.fulfill({
      status: 404,
      json: { message: "Unexpected fixture request" },
    });
  });
  try {
    await page.goto(`${base}/recruitment/reports`);
    await page
      .getByRole("table", { name: "Bảng báo cáo tuyển dụng" })
      .waitFor();
    const initialRequests = reportRequests;
    for (const width of [1920, 1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (theme) =>
            document.documentElement.classList.toggle("dark", theme === "dark"),
          theme,
        );
        const tabs = page
          .getByRole("tablist", { name: "Báo cáo tuyển dụng" })
          .getByRole("tab");
        for (let index = 0; index < (await tabs.count()); index += 1) {
          await tabs.nth(index).click();
          const panel = page.getByRole("tabpanel");
          const figure = panel.getByRole("figure");
          await figure.waitFor();
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          );
          assert(
            !overflow,
            `horizontal page overflow at ${width}/${theme}/${index}`,
          );
          assert(
            await figure.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          );
          const next = panel.getByRole("button", {
            name: "Trang sau",
            exact: true,
          });
          await next.scrollIntoViewIfNeeded();
          const visible = await next.evaluate((el) => {
            const button = el.getBoundingClientRect();
            const main = document.querySelector("main").getBoundingClientRect();
            const panel = document
              .querySelector('[role="tabpanel"]')
              .getBoundingClientRect();
            return (
              button.bottom <= main.bottom + 1 &&
              button.bottom <= panel.bottom &&
              button.top >= main.top
            );
          });
          assert(visible, `pagination clipped at ${width}/${theme}/${index}`);
          checks.push({ width, theme, tab: index, result: "passed" });
          if ([1920, 390].includes(width) && index === 0) {
            await page.screenshot({
              path: `${output}/${width}-${theme}.png`,
              animations: "disabled",
            });
            await page.locator("main").evaluate((el) => {
              el.scrollTop = 0;
            });
            await page.screenshot({
              path: `${output}/${width}-${theme}-overview.png`,
              animations: "disabled",
            });
          }
        }
      }
    }
    assert.equal(
      reportRequests,
      initialRequests,
      "tab switches must not refetch reports",
    );
    await page.getByRole("tab").first().click();
    await page.getByRole("button", { name: "Trang sau", exact: true }).click();
    assert.equal(
      await page
        .getByRole("table", { name: "Bảng báo cáo tuyển dụng" })
        .locator("tbody tr")
        .count(),
      1,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".recruitment-chart-bar")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByRole("tab", { name: "Theo bộ phận", exact: true }).click();
    assert.equal(
      await page
        .locator(".recruitment-chart-bar")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
      "recruitment-bar-grow",
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      `${output}/summary.json`,
      JSON.stringify(
        {
          checks,
          errors,
          reportRequests,
          reducedMotion: "passed",
          pagination: "passed",
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({ checks: checks.length, errors, reportRequests, output }),
    );
  } catch (error) {
    await page.screenshot({ path: `${output}/failure.png` });
    console.error(await page.locator("body").innerText());
    console.error(errors);
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
