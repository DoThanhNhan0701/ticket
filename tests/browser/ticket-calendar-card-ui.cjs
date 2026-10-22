const ticketTestEnv = require("../env.cjs");
const fs = require("node:fs");
const assert = require("node:assert/strict");
// Read-only real-data QC. JSON stdin: {username,password}.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = ticketTestEnv.baseUrl;
const screenshotDir = process.env.SCREENSHOT_DIR || "/tmp";
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Ho_Chi_Minh",
  });
  const report = {
    base,
    checkedAt: new Date().toISOString(),
    checks: [],
    pageErrors: [],
    blockedWrites: [],
  };
  await context.route("**/api/**", (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname;
    if (
      ["GET", "HEAD", "OPTIONS"].includes(req.method()) ||
      (req.method() === "POST" &&
        ["/api/token/", "/api/token/refresh/"].includes(path))
    )
      return r.continue();
    report.blockedWrites.push(path);
    return r.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.pageErrors.push(e.message));
  try {
    await page.goto(base + "/login");
    await page.locator("#login-username").fill(credentials.username);
    await page.locator("#login-password").fill(credentials.password);
    await page
      .getByRole("button", { name: "Sign In to Ticket", exact: true })
      .click();
    await page.waitForURL((u) => u.pathname !== "/login");
    await page.goto(base + "/recruitment/interviews");
    await page.getByRole("grid", { name: "Lịch phỏng vấn" }).waitFor();
    await page.locator("#recruitment-filter-from").fill("22/10/2026");
    await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
    await page
      .getByRole("article", {
        name: "TEST_REC20_261021 Interview A",
        exact: true,
      })
      .waitFor();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        const toggle = page.getByRole("button", {
          name:
            theme === "light"
              ? "Switch to light theme"
              : "Switch to dark theme",
          exact: true,
        });
        if (await toggle.count()) await toggle.click();
        for (const [mode, name] of [
          ["month", "Tháng"],
          ["week", "Tuần"],
          ["day", "Ngày"],
        ]) {
          await page.getByRole("button", { name, exact: true }).click();
          const card = page.getByRole("article", {
            name: "TEST_REC20_261021 Interview A",
            exact: true,
          });
          await card.waitFor();
          await card.scrollIntoViewIfNeeded();
          assert.equal(
            await page
              .getByRole("button", { name, exact: true })
              .getAttribute("aria-pressed"),
            "true",
          );
          assert(await card.getByText("13:00 – 14:00").count());
          const bounds = await card.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return {
              height: r.height,
              width: r.width,
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              actions: [...el.querySelectorAll("button")].map((b) => {
                const q = b.getBoundingClientRect();
                return {
                  label: b.getAttribute("aria-label"),
                  inside:
                    q.left >= r.left &&
                    q.right <= r.right &&
                    q.top >= r.top &&
                    q.bottom <= r.bottom,
                };
              }),
            };
          });
          assert.equal(bounds.actions.length, 3);
          assert(
            bounds.actions.every((b) => b.inside),
            JSON.stringify(bounds),
          );
          assert(
            bounds.scrollHeight <= bounds.clientHeight + 1,
            JSON.stringify(bounds),
          );
          if (mode === "month")
            assert(bounds.height < 125, "month card should fit content");
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          );
          assert(!overflow, "page horizontal overflow");
          await page.screenshot({
            path: `${screenshotDir}/ticket-calendar-${width}-${theme}-${mode}.png`,
            animations: "disabled",
          });
          if (width === 1440 && theme === "light")
            await card.screenshot({
              path: `${screenshotDir}/ticket-calendar-card-${mode}.png`,
              animations: "disabled",
            });
          report.checks.push({ mode, width, theme, result: "passed", bounds });
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const name of ["Tháng", "Tuần", "Ngày"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await page
        .getByRole("button", {
          name: "Sửa lịch TEST_REC20_261021 Interview A",
          exact: true,
        })
        .click();
      await page.getByRole("dialog").waitFor();
      assert.equal(
        await page.getByLabel(/^Ngày phỏng vấn/).inputValue(),
        "22/10/2026",
      );
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      report.checks.push({
        case: `Open and cancel edit from ${name}`,
        result: "passed",
      });
    }
    assert.equal(report.pageErrors.length, 0);
    assert.equal(report.blockedWrites.length, 0);
  } finally {
    fs.writeFileSync(
      "tests/artifacts/ticket-calendar-card-ui.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    await browser.close();
  }
  console.log(
    JSON.stringify({
      checks: report.checks.length,
      pageErrors: report.pageErrors,
      blockedWrites: report.blockedWrites,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
