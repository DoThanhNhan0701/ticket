const ticketTestEnv = require("../env.cjs");
// UI/edge-case QC against the real API. Credentials: {admin:{username,password}} on stdin.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = ticketTestEnv.baseUrl;
const artifact = "tests/artifacts/ticket-recruitment-ui-boundaries.json";
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const report = {
    checks: [],
    pageErrors: [],
    mutations: [],
    layouts: [],
    apiErrors: [],
  };
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith("/api/") && response.status() >= 400)
      report.apiErrors.push({ path, status: response.status() });
  });
  await page.route("**/api/**", (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
      !["/api/token/", "/api/token/refresh/"].includes(path)
    ) {
      report.mutations.push({ method: request.method(), path });
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  const passed = (name) => {
    report.checks.push({ case: name, result: "passed" });
    console.log(name);
  };
  async function search() {
    const drawer = page.getByRole("dialog", { name: "Lọc nâng cao" });
    if (await drawer.count())
      await drawer
        .getByRole("button", { name: "Áp dụng bộ lọc", exact: true })
        .click();
    else
      await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
    await page.waitForLoadState("networkidle");
  }
  async function close() {
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  }
  async function layout(name) {
    await page.waitForLoadState("networkidle");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.classList.toggle("dark", value === "dark");
        document.documentElement.style.colorScheme = value;
      }, theme);
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
        await page.evaluate(() => document.fonts.ready);
        const size = await page.evaluate(() => ({
          viewport: innerWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        assert(
          size.scroll <= size.viewport + 1,
          `${name}/${theme}/${width} body overflow: ${size.scroll}`,
        );
        const form = page.getByRole("form", { name: /Bộ lọc/ });
        const metrics = await form.evaluate((element) => {
          const search = [
            ...element.querySelectorAll('button[type="submit"]'),
          ][0];
          const reset = element.querySelector(
            'button[aria-label="Xóa lọc tuyển dụng"]',
          );
          return {
            searchHeight: search?.getBoundingClientRect().height,
            resetHeight: reset?.getBoundingClientRect().height,
          };
        });
        assert.equal(
          metrics.searchHeight,
          metrics.resetHeight,
          `${name}: filter action heights differ`,
        );
        report.layouts.push({
          page: name,
          theme,
          width,
          overflow: false,
          ...metrics,
        });
        if ([1440, 390].includes(width))
          await page.screenshot({
            path: `/tmp/ticket-recruitment-${name}-${theme}-${width}.png`,
            animations: "disabled",
          });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    passed(name + ": responsive light/dark UI at 1440, 768, 390, 320px");
  }
  try {
    await page.goto(base + "/login");
    await page.locator("#login-username").fill(credentials.admin.username);
    await page.locator("#login-password").fill(credentials.admin.password);
    await page
      .getByRole("button", { name: "Sign In to Ticket", exact: true })
      .click();
    await page.waitForURL((url) => url.pathname !== "/login");
    await page.goto(
      base + "/recruitment/requests?from_date=2026-01-01&to_date=2026-04-20",
    );
    await page
      .getByRole("table", { name: "Bảng yêu cầu tuyển dụng" })
      .waitFor();
    await layout("requests");
    const listRequests = [];
    const listener = (request) => {
      if (new URL(request.url()).pathname === "/api/list_recruitment/")
        listRequests.push(request.url());
    };
    page.on("request", listener);
    await page.getByRole("button", { name: "Lọc nâng cao" }).click();
    await page.locator("#recruitment-filter-from").fill("21/04/2026");
    await search();
    await page
      .getByText("Ngày kết thúc phải từ ngày bắt đầu trở đi.", { exact: true })
      .waitFor();
    assert.equal(listRequests.length, 0);
    await page.locator("#recruitment-filter-from").fill("01/01/2026");
    await page
      .getByText("Ngày kết thúc phải từ ngày bắt đầu trở đi.", { exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(listRequests.length, 0);
    await search();
    assert.equal(listRequests.length, 1);
    page.off("request", listener);
    passed(
      "Date range errors clear after correction; drafts never fetch; identical Search refreshes the list",
    );
    await page
      .getByRole("button", { name: /^Thêm ứng viên / })
      .first()
      .click();
    await page.locator("#recruitment-first_name").waitFor();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Lưu", exact: true })
      .click();
    await page.getByText("Vui lòng nhập họ và tên.", { exact: true }).waitFor();
    await page
      .locator("#recruitment-first_name")
      .fill("TEST UI boundary draft");
    await page
      .getByText("Vui lòng nhập họ và tên.", { exact: true })
      .waitFor({ state: "hidden" });
    await page.locator("#recruitment-numberphone").fill("invalid");
    await page
      .getByText("Số điện thoại phải có từ 10 đến 12 chữ số.", { exact: true })
      .waitFor();
    await page.locator("#recruitment-numberphone").fill("0900000000");
    await page
      .getByText("Số điện thoại phải có từ 10 đến 12 chữ số.", { exact: true })
      .waitFor({ state: "hidden" });
    await page.locator("#recruitment-email").fill("invalid");
    await page.getByText("Email không hợp lệ.", { exact: true }).waitFor();
    await page.locator("#recruitment-email").fill("test-ui@example.invalid");
    await page
      .getByText("Email không hợp lệ.", { exact: true })
      .waitFor({ state: "hidden" });
    await page.setViewportSize({ width: 320, height: 640 });
    const modal = await page.getByRole("dialog").boundingBox();
    assert(
      modal.x >= 0 && modal.x + modal.width <= 321,
      "Create modal exceeds mobile viewport",
    );
    await close();
    await page.setViewportSize({ width: 1440, height: 1000 });
    passed(
      "Candidate required/phone/email errors recover on change; create modal fits 320px; cancel creates no data",
    );
    await page.goto(
      base +
        "/recruitment/candidates?from_date=2020-01-01&to_date=2026-10-21&page_size=100",
    );
    await page.getByRole("table", { name: "Bảng ứng viên" }).waitFor();
    await layout("candidates");
    await page
      .getByRole("button", { name: "Sửa hồ sơ CV_261021_409", exact: true })
      .click();
    await page.locator("#recruitment-first_name").waitFor();
    await page.locator("#recruitment-file_upload").setInputFiles({
      name: "TEST_oversized.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(11 * 1024 * 1024),
    });
    await page
      .getByText("Tệp không được vượt quá 10 MB.", { exact: true })
      .waitFor();
    await page.locator("#recruitment-file_note").setInputFiles({
      name: "TEST_note.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("TEST"),
    });
    assert(
      await page
        .getByText("Tệp không được vượt quá 10 MB.", { exact: true })
        .isVisible(),
    );
    assert(
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Lưu", exact: true })
        .isDisabled(),
    );
    await page.locator("#recruitment-file_upload").setInputFiles([]);
    await page
      .getByText("Tệp không được vượt quá 10 MB.", { exact: true })
      .waitFor({ state: "hidden" });
    await close();
    passed(
      "Oversized CV remains invalid after selecting a valid note; clearing the CV clears its own error",
    );
    await page
      .getByRole("button", {
        name: "Chuyển trạng thái CV_261021_409",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Lưu", exact: true })
      .click();
    await page
      .getByText("Vui lòng chọn trạng thái.", { exact: true })
      .waitFor();
    await close();
    passed(
      "Status change requires an explicit different status and never writes a blank status",
    );
    await page.goto(base + "/recruitment/interviews");
    await page.getByRole("grid", { name: "Lịch phỏng vấn" }).waitFor();
    await layout("interviews");
    const event = page
      .getByRole("button", {
        name: "Sửa lịch TEST QC Interview 261021",
        exact: true,
      })
      .locator("xpath=ancestor::article");
    const clippedActions = await event.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return [...element.querySelectorAll("button")].some((button) => {
        const action = button.getBoundingClientRect();
        return (
          action.top < box.top ||
          action.bottom > box.bottom ||
          action.left < box.left ||
          action.right > box.right
        );
      });
    });
    assert(!clippedActions, "Calendar event clips its action buttons");
    passed(
      "One-hour calendar events expose all action buttons without internal scrolling",
    );
    await page.locator("#recruitment-filter-from").fill("10/12/2030");
    await search();
    await page
      .getByRole("button", { name: "Tạo lịch phỏng vấn", exact: true })
      .click();
    await page.locator("#recruitment-title").waitFor();
    assert.equal(
      await page.locator("#recruitment-start_date").inputValue(),
      "10/12/2030",
    );
    await page.locator("#recruitment-title").fill("TEST UI calendar draft");
    await page.locator("#recruitment-time_start").fill("11:00");
    await page.locator("#recruitment-time_end").fill("10:00");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Lưu", exact: true })
      .click();
    await page
      .getByText("Giờ kết thúc phải sau giờ bắt đầu.", { exact: true })
      .waitFor();
    await page.locator("#recruitment-time_end").fill("12:00");
    await page
      .getByText("Giờ kết thúc phải sau giờ bắt đầu.", { exact: true })
      .waitFor({ state: "hidden" });
    await close();
    passed(
      "Create uses the selected date and reversed interview times recover after correction",
    );
    await page.getByRole("button", { name: "Hôm nay", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Xem CV lịch TEST QC Interview 261021",
        exact: true,
      })
      .click();
    await page.waitForURL(/\/recruitment\/interviews\/[^/]+$/);
    await page.getByRole("table", { name: "CV phỏng vấn" }).waitFor();
    await layout("interview-candidates");
    await page.getByRole("button", { name: "Lọc nâng cao" }).click();
    await page
      .getByRole("combobox", { name: "Giới tính ứng viên", exact: true })
      .click();
    await page.getByRole("option", { name: "Nam", exact: true }).click();
    const filtered = page.waitForResponse((response) =>
      /\/api\/regis-interview\//.test(response.url()),
    );
    await search();
    assert.equal(
      new URL((await filtered).url()).searchParams.get("gender"),
      "Nam",
    );
    await page
      .getByRole("button", { name: "Xóa lọc tuyển dụng", exact: true })
      .click();
    await page.waitForLoadState("networkidle");
    passed(
      "Interview candidate gender selection uses the shared control and sends the real API filter",
    );
    await page.goto(base + "/recruitment/reports");
    await page.locator("#recruitment-filter-from").fill("01/01/2026");
    await page.locator("#recruitment-filter-to").fill("30/06/2026");
    await search();
    await page
      .getByRole("table", { name: "Bảng báo cáo tuyển dụng" })
      .waitFor();
    await layout("reports");
    await page.locator("#recruitment-filter-to").fill("02/07/2026");
    await search();
    await page
      .getByText("Phạm vi tra cứu không quá 6 tháng.", { exact: true })
      .waitFor();
    await page.locator("#recruitment-filter-to").fill("30/06/2026");
    await page
      .getByText("Phạm vi tra cứu không quá 6 tháng.", { exact: true })
      .waitFor({ state: "hidden" });
    passed("Report six-month range validation recovers after correction");
    assert.deepEqual(
      report.mutations,
      [],
      "Invalid forms attempted business writes",
    );
    assert.deepEqual(report.pageErrors, []);
    report.result = "passed";
  } catch (error) {
    report.result = "failed";
    report.failure = error.message;
    await page.screenshot({
      path: "/tmp/ticket-recruitment-ui-boundary-failure.png",
      animations: "disabled",
    });
    throw error;
  } finally {
    fs.writeFileSync(artifact, JSON.stringify(report, null, 2) + "\n");
    console.log(
      JSON.stringify({
        result: report.result,
        checks: report.checks.length,
        failure: report.failure,
      }),
    );
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
