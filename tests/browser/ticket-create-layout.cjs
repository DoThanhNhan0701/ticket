const ticketTestEnv = require("../env.cjs");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
// Credentials {username,password} are read from stdin and never saved. All ticket writes are blocked.
const report = {
  startedAt: new Date().toISOString(),
  source: 14464,
  checks: [],
  runtimeErrors: [],
  blockedWrites: [],
  status: "running",
};
const path =
  process.env.LAYOUT_REPORT || "/tmp/ticket-create-layout-review.json";
const save = () =>
  fs.writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
const check = (name, details = {}) => {
  report.checks.push({ name, status: "passed", ...details });
  save();
  console.log(name);
};
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1914, height: 1000 },
      timezoneId: "Asia/Ho_Chi_Minh",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.on("pageerror", (error) => report.runtimeErrors.push(error.message));
    await page.route("**/api/**", (route) => {
      const req = route.request(),
        p = new URL(req.url()).pathname;
      if (
        req.method() === "GET" ||
        ["/api/token/", "/api/token/refresh/"].includes(p)
      )
        return route.continue();
      report.blockedWrites.push({ method: req.method(), path: p });
      save();
      return route.abort();
    });
    const base = ticketTestEnv.baseUrl;
    await page.goto(base + "/login");
    await page.locator("#login-username").fill(credentials.username);
    await page.locator("#login-password").fill(credentials.password);
    await page
      .getByRole("button", { name: "Sign In to Ticket", exact: true })
      .click();
    await page.waitForURL((url) => !url.pathname.includes("login"));
    await page.goto(base + "/requests/14464");
    await page.getByRole("button", { name: "Sao chép", exact: true }).click();
    await page.waitForURL("**/requests/new?clone=14464");
    await page.waitForFunction(
      () => document.getElementById("detail-0-f0")?.value,
    );
    const snapshot = () =>
      page.evaluate(() => {
        const key = Object.keys(sessionStorage).find(
          (k) =>
            k.startsWith("request-create-draft:v1:") && k.endsWith(":14464"),
        );
        return { key, draft: JSON.parse(sessionStorage.getItem(key)) };
      });

    const initial = await snapshot();
    const metrics = () =>
      page.evaluate(() => {
        const main = document.querySelector("main");
        const form = document.querySelector(
          'form[aria-label="Tạo yêu cầu mới"]',
        );
        const region = document.querySelector(
          '[role="region"][aria-label="Các dòng chi tiết yêu cầu"]',
        );
        return {
          mainWidth: main.clientWidth,
          mainScrollWidth: main.scrollWidth,
          mainScrollLeft: main.scrollLeft,
          formWidth: form.clientWidth,
          formScrollWidth: form.scrollWidth,
          tableWidth: region.clientWidth,
          tableScrollWidth: region.scrollWidth,
          tableScrollLeft: region.scrollLeft,
        };
      });
    const verify = async (flow, viewport) => {
      await page.setViewportSize(viewport);
      await page.waitForFunction(() => {
        const main = document.querySelector("main");
        return main.scrollWidth <= main.clientWidth + 1;
      });
      const region = page.getByRole("region", {
        name: "Các dòng chi tiết yêu cầu",
        exact: true,
      });
      await region.evaluate((el) => (el.scrollLeft = el.scrollWidth));
      const dimensions = await metrics();
      assert(dimensions.formScrollWidth <= dimensions.formWidth + 1);
      assert.equal(dimensions.mainScrollLeft, 0);
      assert(dimensions.tableScrollWidth > dimensions.tableWidth);
      assert(dimensions.tableScrollLeft > 0);
      await region.locator("input:not([type=hidden])").last().focus();
      assert.equal((await metrics()).mainScrollLeft, 0);
      check(flow + "-" + viewport.width, { viewport, ...dimensions });
      await region.evaluate((el) => (el.scrollLeft = 0));
    };
    for (const viewport of [
      { width: 1914, height: 1000 },
      { width: 1440, height: 1000 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 320, height: 740 },
    ])
      await verify("clone-wide-template", viewport);
    await page.setViewportSize({ width: 1914, height: 1000 });
    await page
      .getByRole("button", { name: "Thu gọn sidebar", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelector("main").getBoundingClientRect().left < 100,
    );
    await verify("clone-collapsed-sidebar", { width: 1914, height: 1000 });
    await page.evaluate(() =>
      document.documentElement.classList.remove("dark"),
    );
    await verify("clone-light-collapsed-sidebar", {
      width: 1914,
      height: 1000,
    });
    await page.screenshot({
      path: "/tmp/ticket-create-layout-desktop.png",
      animations: "disabled",
    });
    await page.evaluate(
      ({ key, draft }) =>
        sessionStorage.setItem(
          key.replace(/:14464$/, ":new"),
          JSON.stringify(draft),
        ),
      initial,
    );
    await page.goto(base + "/requests/new");
    await page.waitForFunction(
      () => document.getElementById("detail-0-f0")?.value,
    );
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ])
      await verify("normal-create-restored-wide-draft", viewport);
    await page.screenshot({
      path: "/tmp/ticket-create-layout-mobile.png",
      animations: "disabled",
    });
    assert.deepEqual(report.blockedWrites, []);
    assert.deepEqual(report.runtimeErrors, []);
    report.status = "passed";
    report.completedAt = new Date().toISOString();
    save();
  } catch (error) {
    report.status = "failed";
    report.error = error.message;
    save();
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
