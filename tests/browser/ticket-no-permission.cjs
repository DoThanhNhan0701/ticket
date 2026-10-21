// Read-only UI regression for a real account without functional permissions.
// Supply { username, password } on stdin. Credentials never enter the report.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:5189";
const reportPath =
  process.env.NO_PERMISSION_REPORT ||
  "tests/artifacts/ticket-no-permission.json";
const paths = [
  "/requests",
  "/requests/new",
  "/requests/all",
  "/requests/change-status",
  "/requests/14361",
  "/tickets/from-email/14361",
  "/approvals/pending",
  "/approvals/approved",
  "/tasks/mine",
  "/tasks",
  "/reports",
  "/reports/export",
  "/recruitment/requests",
  "/recruitment/candidates",
  "/recruitment/interviews",
  "/recruitment/reports",
  "/recruitment/interviews/TEST_QC_PERMISSION",
  "/settings/users",
  "/settings/requesting-departments",
  "/settings/handling-departments",
  "/settings/request-types",
  "/settings/teams",
  "/settings/positions",
  "/settings/offices",
  "/settings/users/new",
  "/settings",
];
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
  assert(
    credentials.username && credentials.password,
    "Supply credentials on stdin",
  );
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const report = {
    date: "2026-10-21",
    base,
    username: credentials.username,
    method: "Browser UI with real API, read-only",
    checks: [],
    apiRequests: [],
    blockedWrites: [],
    pageErrors: [],
    result: "running",
  };
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.on("pageerror", (e) => report.pageErrors.push(e.message));
    await page.route("**/api/**", (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      report.apiRequests.push({ method: request.method(), path });
      if (
        !["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
        !["/api/token/", "/api/token/refresh/"].includes(path)
      ) {
        report.blockedWrites.push({ method: request.method(), path });
        return route.abort();
      }
      return route.continue();
    });
    const denied = () =>
      page.getByRole("heading", {
        name: "Bạn chưa có quyền truy cập",
        exact: true,
      });
    const sidebar = () =>
      page.getByRole("complementary", { name: "Sidebar Ticket" });
    async function verifyDenied() {
      await denied().waitFor();
      await page.waitForLoadState("networkidle");
      assert.equal(await sidebar().locator("a[href]").count(), 0);
      assert.match(
        await sidebar().getByRole("status").innerText(),
        /Chưa có mục truy cập/,
      );
      assert.equal(
        await page
          .getByRole("link", { name: "Tạo yêu cầu", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("heading", { name: "Không tải được trang", exact: true })
          .count(),
        0,
      );
    }
    await page.goto(base + "/login");
    await page.locator("#login-username").fill(credentials.username);
    await page.locator("#login-password").fill(credentials.password);
    const loaded = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/list_permission/",
    );
    await page
      .getByRole("button", { name: "Sign In to Ticket", exact: true })
      .click();
    const response = await loaded;
    assert(response.ok());
    const account = await response.json();
    report.account = {
      userId: account.infoUser[0],
      userPermission: account.userPermission,
      handlingPermission: account.handlingPermission,
      is_handling: account.is_handling,
      is_superuser: account.is_superuser,
    };
    assert.deepEqual(account.userPermission, []);
    assert.deepEqual(account.handlingPermission, {});
    assert.equal(account.is_handling, false);
    assert.equal(account.is_superuser, false);
    await page.waitForURL("**/requests");
    await verifyDenied();
    report.checks.push({ case: "Login without permissions", result: "passed" });
    await page.reload();
    await verifyDenied();
    report.checks.push({
      case: "Reload preserves denied state",
      result: "passed",
    });
    for (const path of ["/", "/login", "/unknown-permission-page"]) {
      await page.goto(base + path);
      await page.waitForURL("**/requests");
      await verifyDenied();
      report.checks.push({
        case: "Stable fallback from " + path,
        result: "passed",
      });
    }
    for (const path of paths) {
      await page.goto(base + path);
      await verifyDenied();
      report.checks.push({ case: "Direct URL " + path, result: "passed" });
    }
    await page.goto(base + "/settings/chucvu?search=TEST#records");
    await page.waitForURL("**/settings/positions?search=TEST#records");
    await verifyDenied();
    report.checks.push({
      case: "Legacy URL preserves query/hash and remains denied",
      result: "passed",
    });
    await page
      .getByRole("link", { name: "Rainscales Ticket home", exact: true })
      .click();
    await page.waitForURL("**/requests");
    await verifyDenied();
    report.checks.push({
      case: "Brand link has a stable denied destination",
      result: "passed",
    });
    await page
      .getByRole("button", { name: "Thu gọn sidebar", exact: true })
      .click();
    await page.reload();
    await page
      .getByRole("button", { name: "Mở rộng sidebar", exact: true })
      .waitFor();
    await verifyDenied();
    assert.match(
      await sidebar().getByRole("status").getAttribute("title"),
      /Chưa có mục truy cập/,
    );
    report.checks.push({
      case: "Collapsed empty sidebar survives reload",
      result: "passed",
    });
    await page
      .getByRole("button", { name: "Mở rộng sidebar", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.getElementById("desktop-sidebar").getBoundingClientRect()
          .width === 288,
    );
    await page.screenshot({
      path: "/tmp/ticket-no-permission-desktop.png",
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const trigger = page.getByRole("button", {
      name: "Mở menu điều hướng",
      exact: true,
    });
    await trigger.click();
    const mobile = page.getByRole("dialog", {
      name: "Điều hướng Ticket",
      exact: true,
    });
    await mobile.waitFor();
    assert.equal(await mobile.locator("a[href]").count(), 0);
    assert.match(
      await mobile.getByRole("status").innerText(),
      /Chưa có mục truy cập/,
    );
    await page.screenshot({
      path: "/tmp/ticket-no-permission-mobile.png",
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await mobile.waitFor({ state: "hidden" });
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("aria-label") ===
        "Mở menu điều hướng",
    );
    report.checks.push({
      case: "Mobile empty menu, Escape and focus restoration",
      result: "passed",
    });
    await page.getByRole("button", { name: "Sign Out", exact: true }).click();
    await page
      .getByRole("button", { name: "Sign In to Ticket", exact: true })
      .waitFor();
    await page.goBack();
    await page
      .getByRole("button", { name: "Sign In to Ticket", exact: true })
      .waitFor();
    assert.equal(await sidebar().count(), 0);
    report.checks.push({
      case: "Sign out and browser Back cannot reopen private content",
      result: "passed",
    });
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.blockedWrites, []);
    const dataRequests = report.apiRequests.filter(
      (r) =>
        ![
          "/api/token/",
          "/api/token/refresh/",
          "/api/list_permission/",
        ].includes(r.path),
    );
    assert.deepEqual(
      dataRequests,
      [],
      "Denied page called a business-data API",
    );
    report.businessDataRequests = dataRequests;
    report.result = "passed";
  } catch (error) {
    report.result = "failed";
    report.failure = error.message;
    throw error;
  } finally {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
    await browser.close();
    console.log(
      JSON.stringify({
        report: reportPath,
        result: report.result,
        checks: report.checks.length,
        failure: report.failure,
      }),
    );
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
