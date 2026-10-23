const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ticketTestEnv = require("../env.cjs");
const { username, password } = JSON.parse(fs.readFileSync(0, "utf8"));
const base = ticketTestEnv.baseUrl;
const reportPath =
  process.env.PROGRESS_REPORT || "/tmp/ticket-hr-progress-review.json";
const artifacts = require("node:path").dirname(reportPath);
// Credentials {username,password} come from stdin. No ticket writes are allowed.
const report = {
  environment: process.env.TEST_ENV || "development",
  department: "HR",
  checks: [],
  errors: [],
  blockedWrites: [],
  requests: [],
  metrics: {},
};
const record = (name) => {
  report.checks.push(name);
  console.log(name);
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE,
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Ho_Chi_Minh",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.addInitScript(() => {
    window.__qa = { observes: 0, disconnects: 0, samples: [], longTasks: [] };
    const Native = window.ResizeObserver;
    window.ResizeObserver = class extends Native {
      observe(target, options) {
        if (target.getAttribute("aria-label") === "Các dòng chi tiết yêu cầu") {
          this.isDetail = true;
          window.__qa.observes++;
        }
        super.observe(target, options);
      }
      disconnect() {
        if (this.isDetail) window.__qa.disconnects++;
        super.disconnect();
      }
    };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        window.__qa.longTasks.push({
          start: e.startTime,
          duration: e.duration,
        });
    }).observe({ type: "longtask", buffered: true });
    document.addEventListener(
      "input",
      (e) => {
        if (!e.target.id?.startsWith("detail-")) return;
        const start = performance.now();
        requestAnimationFrame(() =>
          window.__qa.samples.push(performance.now() - start),
        );
      },
      true,
    );
  });
  await page.route("**/api/**", (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (
      request.method() === "GET" ||
      ["/api/token/", "/api/token/refresh/"].includes(path)
    ) {
      report.requests.push({ method: request.method(), path });
      return route.continue();
    }
    report.blockedWrites.push({ method: request.method(), path });
    return route.abort();
  });
  try {
    await page.goto(base + "/login");
    await page.locator("#login-username").fill(username);
    await page.locator("#login-password").fill(password);
    await page
      .getByRole("button", { name: "Sign In to Ticket", exact: true })
      .click();
    await page.waitForURL("**/requests");
    await page.goto(base + "/requests/new");
    const choose = async (label, option) => {
      await page.getByRole("combobox", { name: label, exact: true }).click();
      if (option) {
        await page
          .getByRole("combobox", {
            name: "Tìm " + label.toLowerCase(),
            exact: true,
          })
          .fill(option);
        await page.getByRole("option", { name: option, exact: true }).click();
      } else await page.getByRole("option").first().click();
    };
    await choose("Bộ phận xử lý", "HR");
    await choose("Loại yêu cầu", "Đề nghị chấm dứt Hợp đồng lao động");
    await choose("Người phê duyệt");
    // A company may already be selected from the account profile.
    const company = page.getByRole("combobox", {
      name: "Công ty",
      exact: true,
    });
    if ((await company.innerText()).includes("Chọn")) await choose("Công ty");
    await page.locator("#create-title").fill("TEST HR progress UI review");
    await choose("Department");
    await choose("Văn phòng");
    await page.locator("#detail-0-f0").waitFor();
    record("HR template loaded from TEST API");
    const region = page.getByRole("region", {
      name: "Các dòng chi tiết yêu cầu",
      exact: true,
    });
    const next = page.getByRole("button", {
      name: "Đến ô chưa nhập",
      exact: true,
    });
    await next.waitFor();
    const requiredCount = await region
      .locator("input[aria-required=true]")
      .count();
    assert.equal(requiredCount, 10);
    await page
      .getByText("Đã nhập 0/10 ô bắt buộc · Còn 10 ô chưa nhập", {
        exact: true,
      })
      .waitFor();
    record("10 required HR inputs including both handover dates");
    // Typing must not recreate the detail ResizeObserver or issue API calls.
    const measureTyping = async () => {
      const before = await page.evaluate(() => ({
        observes: window.__qa.observes,
        sample: window.__qa.samples.length,
        started: performance.now(),
      }));
      const requests = report.requests.length;
      await page
        .locator("#detail-0-f0")
        .pressSequentially("TEST-HR-EMPLOYEE-0123456789", { delay: 5 });
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const metrics = await page.evaluate((before) => {
        const data = window.__qa.samples
          .slice(before.sample)
          .sort((a, b) => a - b);
        return {
          observes: window.__qa.observes,
          inputCount: data.length,
          inputToFrameP95Ms: data[Math.floor(data.length * 0.95)],
          inputToFrameMaxMs: Math.max(...data),
          longTasks: window.__qa.longTasks.filter(
            (task) => task.start >= before.started,
          ),
        };
      }, before);
      assert.equal(metrics.observes, before.observes);
      assert.equal(report.requests.length, requests);
      return metrics;
    };
    report.metrics.oneRow = await measureTyping();
    record("Typing keeps detail observer stable and makes no API requests");
    // Fill every required input except the last offscreen handover recipient.
    const required = region.locator("input[aria-required=true]");
    for (let i = 0; i < requiredCount - 1; i++) {
      const input = required.nth(i),
        id = await input.getAttribute("id");
      const value =
        id.includes("f6") || id.includes("f7") ? "26/10/2026" : "TEST HR " + i;
      await input.fill(value);
    }
    await page
      .getByText("Đã nhập 9/10 ô bắt buộc · Còn 1 ô chưa nhập", { exact: true })
      .waitFor();
    await region.evaluate((el) => (el.scrollLeft = 0));
    await next.click();
    const targetId = await required.last().getAttribute("id");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      targetId,
    );
    assert((await region.evaluate((el) => el.scrollLeft)) > 0);
    record("Next missing input gains focus and scrolls into view");
    await required.last().fill("TEST HR recipient");
    await next.waitFor({ state: "hidden" });
    record("Reminder hides after all required HR inputs are filled");
    await page.locator("#detail-0-f0").fill("");
    await next.waitFor();
    record("Reminder returns when a required HR input is cleared");
    await page
      .getByRole("button", { name: "Sao chép dòng 1", exact: true })
      .click();
    await page
      .getByText("Đã nhập 18/20 ô bắt buộc · Còn 2 ô chưa nhập", {
        exact: true,
      })
      .waitFor();
    await page.getByRole("button", { name: "Xóa dòng 2", exact: true }).click();
    await page
      .getByText("Đã nhập 9/10 ô bắt buộc · Còn 1 ô chưa nhập", { exact: true })
      .waitFor();
    record("HR add/copy/delete rows keeps missing counts correct");
    for (let index = 1; index < 10; index++)
      await page
        .getByRole("button", { name: "Sao chép dòng 1", exact: true })
        .click();
    await page
      .getByText("Đã nhập 90/100 ô bắt buộc · Còn 10 ô chưa nhập", {
        exact: true,
      })
      .waitFor();
    report.metrics.tenRows = await measureTyping();
    await page
      .getByText("Đã nhập 91/100 ô bắt buộc · Còn 9 ô chưa nhập", {
        exact: true,
      })
      .waitFor();
    for (let index = 10; index > 1; index--)
      await page
        .getByRole("button", { name: `Xóa dòng ${index}`, exact: true })
        .click();
    await page.locator("#detail-0-f0").fill("");
    record(
      "Typing with 10 HR rows / 100 required inputs keeps observer stable and makes no API requests",
    );
    // The complete table fits only at a wide viewport; reminder must follow actual overflow.
    await page.setViewportSize({ width: 3200, height: 1000 });
    await page.waitForFunction(() => {
      const r = document.querySelector(
        '[aria-label="Các dòng chi tiết yêu cầu"]',
      );
      return r.scrollWidth <= r.clientWidth;
    });
    await next.waitFor({ state: "hidden" });
    await page.setViewportSize({ width: 412, height: 922 });
    await next.waitFor();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    const box = await next.evaluate((el) =>
      el.parentElement.getBoundingClientRect().toJSON(),
    );
    assert(box.x >= 0 && box.right <= 412);
    await page.screenshot({ path: artifacts + "/hr-mobile.png" });
    record(
      "Reminder follows horizontal overflow on desktop/mobile without page overflow",
    );
    report.metrics.overall = await page.evaluate(() => {
      const data = window.__qa.samples.slice().sort((a, b) => a - b);
      return {
        inputCount: data.length,
        inputToFrameP95Ms: data[Math.floor(data.length * 0.95)],
        inputToFrameMaxMs: Math.max(...data),
        detailObserverStarts: window.__qa.observes,
        detailObserverDisconnects: window.__qa.disconnects,
      };
    });
    assert.equal(report.errors.length, 0);
    assert.equal(report.blockedWrites.length, 0);
    record("No runtime errors or ticket writes");
    report.status = "passed";
  } catch (e) {
    report.status = "failed";
    report.failure = e.message;
    await page
      .screenshot({ path: artifacts + "/hr-failure.png" })
      .catch(() => {});
    throw e;
  } finally {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
