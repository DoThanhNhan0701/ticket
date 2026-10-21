// Read-only browser QC. JSON stdin: {admin:{username,password},viewer:{username,password},none:{username,password}}.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:5189";
const artifact = "tests/artifacts/ticket-recruitment-readback.json";
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const report = { checks: [], pageErrors: [] };
  async function login(account) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.on("pageerror", (e) => report.pageErrors.push(e.message));
    await page.route("**/api/**", (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      assert(
        ["GET", "HEAD", "OPTIONS"].includes(request.method()) ||
          ["/api/token/", "/api/token/refresh/", "/api/export_rect/"].includes(
            path,
          ),
        "Unexpected mutation " + path,
      );
      return route.continue();
    });
    await page.goto(base + "/login");
    await page.locator("#login-username").fill(account.username);
    await page.locator("#login-password").fill(account.password);
    await page
      .getByRole("button", { name: "Sign In to Ticket", exact: true })
      .click();
    await page.waitForURL((url) => url.pathname !== "/login");
    return page;
  }
  const passed = (name) => report.checks.push({ case: name, result: "passed" });
  try {
    const page = await login(credentials.admin);
    await page.goto(
      base + "/recruitment/requests?from_date=2026-01-01&to_date=2026-04-20",
    );
    await page
      .getByRole("button", { name: /^Xem yêu cầu / })
      .first()
      .click();
    await page.locator("#recruitment-ticket_code").waitFor();
    assert(await page.locator("#recruitment-ticket_code").isDisabled());
    assert(await page.locator("#recruitment-title").isDisabled());
    assert(!(await page.locator("#recruitment-quantity").isDisabled()));
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    passed("Read request detail with correct editable and ticket-owned fields");
    await page.goto(base + "/recruitment/interviews");
    await page.getByRole("grid", { name: "Lịch phỏng vấn" }).waitFor();
    for (const name of ["Tháng", "Ngày", "Tuần"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await page.getByRole("grid", { name: "Lịch phỏng vấn" }).waitFor();
      passed("Calendar view " + name);
    }
    await page
      .getByRole("button", {
        name: "Xem CV lịch TEST QC Interview 261021",
        exact: true,
      })
      .click();
    await page.waitForURL(/\/recruitment\/interviews\/[^/]+$/);
    const interviewUrl = page.url();
    await page.getByRole("table", { name: "CV phỏng vấn" }).waitFor();
    await page.goto(base + "/recruitment/reports");
    await page.locator("#recruitment-filter-from").fill("01/01/2026");
    await page.locator("#recruitment-filter-to").fill("30/06/2026");
    await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
    await page
      .getByRole("table", { name: "Bảng báo cáo tuyển dụng" })
      .waitFor();
    for (const tab of [
      "Theo yêu cầu tuyển dụng",
      "Theo bộ phận",
      "Theo người phụ trách",
      "Thời gian tuyển dụng",
      "Theo nguồn ứng viên",
      "Tỷ lệ chuyển đổi CV",
      "Trạng thái CV",
      "Bộ phận theo tháng",
    ]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await page
        .getByRole("table", { name: "Bảng báo cáo tuyển dụng" })
        .waitFor();
      passed("Report " + tab);
    }
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Xuất Excel", exact: true }).click();
    const file = await downloaded;
    assert.equal(await file.failure(), null);
    report.exportBytes = fs.statSync(await file.path()).size;
    assert(report.exportBytes > 0);
    passed("Export report Excel");
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )),
    );
    await page.screenshot({
      path: "/tmp/ticket-recruitment-report-mobile.png",
    });
    passed("Report fits mobile viewport");
    for (const [name, account] of [
      ["viewer", credentials.viewer],
      ["none", credentials.none],
    ]) {
      const user = await login(account);
      const protectedRequests = [];
      user.on("request", (request) => {
        if (
          /\/api\/(list_recruitment|list_cv|list-interview|report_rect)\//.test(
            request.url(),
          )
        )
          protectedRequests.push(new URL(request.url()).pathname);
      });
      for (const section of [
        "requests",
        "candidates",
        "interviews",
        "reports",
      ]) {
        await user.goto(base + "/recruitment/" + section);
        await user
          .getByText("Bạn chưa có quyền truy cập", { exact: true })
          .waitFor();
      }
      assert.deepEqual(protectedRequests, []);
      passed(name + " cannot mount or fetch the four HR pages");
      await user.goto(interviewUrl);
      if (name === "viewer") {
        await user
          .getByText(
            "Không có quyền truy cập. Vui lòng liên hệ bộ phận nhân sự.",
            { exact: true },
          )
          .waitFor();
        assert.equal(
          await user
            .getByRole("button", { name: /^Đặt giờ|^Bỏ khỏi lịch|^Sửa hồ sơ/ })
            .count(),
          0,
        );
        assert.equal(
          await user.getByRole("table", { name: "CV phỏng vấn" }).count(),
          0,
        );
        passed(
          "Unassigned interview-only real account preserves backend record access denial",
        );
      } else {
        await user
          .getByText("Bạn chưa có quyền truy cập", { exact: true })
          .waitFor();
        passed("No-permission account cannot access interview detail");
      }
      await user.close();
    }
    assert.deepEqual(report.pageErrors, []);
    report.result = "passed";
  } catch (error) {
    report.result = "failed";
    report.failure = error.message;
    throw error;
  } finally {
    fs.writeFileSync(artifact, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
