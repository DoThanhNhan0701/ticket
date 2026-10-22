const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
// Read-only smoke test against retained TEST tickets. Credentials arrive on stdin.
// Input: {cases:[{username,password,ticketId,expectedEditButtons}]}.
(async () => {
  const { cases } = JSON.parse(fs.readFileSync(0, "utf8"));
  const root = process.env.API_URL || "https://ticket-api.aiminds.io.vn/api";
  const base = process.env.BASE_URL || "http://127.0.0.1:5198";
  const report = {
    startedAt: new Date().toISOString(),
    checks: [],
    mutations: [],
    runtimeErrors: [],
  };
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
      : {}),
    args: ["--no-sandbox"],
  });
  try {
    for (const item of cases) {
      assert(item.username === "admin" || item.username.startsWith("test_"));
      const login = await fetch(root + "/token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: item.username,
          password: item.password,
        }),
      });
      assert(login.ok, "Login failed " + login.status);
      const token = await login.json();
      const response = await fetch(root + "/ticket_manager/" + item.ticketId, {
        headers: { Authorization: "Bearer " + token.access },
      });
      assert(response.ok);
      const ticket = await response.json();
      assert(ticket.title.startsWith("TEST_ACT22_"));
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      await ctx.addCookies([
        { name: "_access_token_ticket", value: token.access, url: base },
        { name: "_refresh_token_ticket", value: token.refresh, url: base },
      ]);
      await ctx.route("**/api/**", (route) => {
        const req = route.request();
        if (req.method() === "GET") return route.continue();
        report.mutations.push({
          method: req.method(),
          path: new URL(req.url()).pathname,
        });
        return route.abort();
      });
      const page = await ctx.newPage();
      page.on("pageerror", (error) => report.runtimeErrors.push(error.message));
      await page.goto(base + "/requests/" + item.ticketId + "?tab=details");
      await page
        .getByRole("heading", { name: "Chi tiết yêu cầu", exact: true })
        .first()
        .waitFor();
      await page
        .getByRole("tab", { name: "Chi tiết yêu cầu", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Xử lý TEST", exact: true })
        .waitFor();
      const buttons = await page
        .getByRole("button", { name: "Chỉnh sửa", exact: true })
        .count();
      assert.equal(
        buttons,
        item.expectedEditButtons,
        item.username + " on " + item.ticketId,
      );
      if (buttons) {
        await page
          .getByRole("button", { name: "Chỉnh sửa", exact: true })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Lưu thay đổi", exact: true })
          .waitFor();
        await page.getByTitle("Hủy chỉnh sửa", { exact: true }).click();
      }
      report.checks.push({
        actor: item.username,
        ticketId: item.ticketId,
        ticketStatus: ticket.ticket_status,
        expectedEditButtons: item.expectedEditButtons,
        actualEditButtons: buttons,
        status: "passed",
      });
      await ctx.close();
    }
    assert.equal(report.mutations.length, 0);
    assert.equal(report.runtimeErrors.length, 0);
    report.status = "passed";
    report.completedAt = new Date().toISOString();
    fs.writeFileSync(
      process.env.FIELD_ACCESS_REPORT ||
        "/tmp/ticket-field-access-live-result.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
