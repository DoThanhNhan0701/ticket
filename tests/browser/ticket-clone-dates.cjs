const ticketTestEnv = require("../env.cjs");
// Live regression: credentials {username,password} on stdin; no credentials/state fixtures saved.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = ticketTestEnv.baseUrl;
const api = ticketTestEnv.apiUrl;
const reportPath =
  process.env.DATE_REPORT || "tests/artifacts/ticket-clone-dates.json";
const report = {
  source: 14134,
  method:
    "UI login, clone and validation; real API create/readback; UI cancellation of TEST ticket",
  checks: [],
  calls: [],
  runtimeErrors: [],
};
const save = () =>
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
const record = (name, details = {}) => {
  report.checks.push({ name, ...details });
  save();
  console.log(name);
};
let browser;
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Ho_Chi_Minh",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on("pageerror", (e) => report.runtimeErrors.push(e.message));
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/ticket_manager"
    )
      writes++;
  });
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (/\/api\/(ticket_manager|template_form|cancel_ticket)/.test(path))
      report.calls.push({
        method: response.request().method(),
        path,
        status: response.status(),
      });
  });
  await page.goto(base + "/login");
  await page.locator("#login-username").fill(credentials.username);
  await page.locator("#login-password").fill(credentials.password);
  const loginResponse = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/token/",
  );
  await page
    .getByRole("button", { name: "Sign In to Ticket", exact: true })
    .click();
  const { access } = await (await loginResponse).json();
  assert(access);
  await page.waitForURL("**/requests");
  const get = async (path) => {
    const response = await context.request.get(api + path, {
      headers: { Authorization: "Bearer " + access },
    });
    report.calls.push({
      method: "GET",
      path: "/api" + path,
      status: response.status(),
    });
    assert(response.ok());
    return response.json();
  };
  const source = await get("/ticket_manager/14134");
  const template = await get("/template_form/" + source.ticket_type);
  assert.equal(source.ticket_type, 64);
  assert.equal(source.data_item.dataform.data[0]["Thời gian đào tạo"], "");
  assert(
    template.forms
      .flatMap((g) => g.children)
      .some((f) => f.type === "range-date-text" && f.required),
  );
  record("real-source-has-empty-required-training-range", {
    type: source.ticket_type,
  });
  await page.goto(base + "/requests/new?clone=14134");
  const start = page.locator("#detail-0-f3-start"),
    end = page.locator("#detail-0-f3-end");
  await end.waitFor();
  assert.equal(await start.inputValue(), "");
  assert.equal(await end.inputValue(), "");
  assert.equal(
    await page.locator("#detail-0-f0").inputValue(),
    source.data_item.dataform.data[0]["Mã số Nhân viên"],
  );
  const submit = page.getByRole("button", { name: "Tạo yêu cầu", exact: true });
  const invalid = async (name, startValue, endValue, badIds) => {
    await start.fill(startValue);
    await end.fill(endValue);
    await submit.click();
    for (const id of badIds)
      await page.waitForFunction(
        (id) =>
          document.getElementById(id)?.getAttribute("aria-invalid") === "true",
        id,
      );
    assert.equal(writes, 0);
    record(name);
  };
  await invalid("missing-both-endpoints-blocked-before-post", "", "", [
    "detail-0-f3-start",
    "detail-0-f3-end",
  ]);
  await invalid("missing-end-blocked-before-post", "20/10/2026", "", [
    "detail-0-f3-end",
  ]);
  await invalid("missing-start-blocked-before-post", "", "21/10/2026", [
    "detail-0-f3-start",
  ]);
  await invalid(
    "unfinished-date-blocked-before-post",
    "20/10/202",
    "21/10/2026",
    ["detail-0-f3-start"],
  );
  await start.fill("");
  await start.fill("31/02/2026");
  assert.equal(await start.inputValue(), "");
  record("impossible-date-input-rejected");
  await invalid(
    "reversed-range-blocked-on-end-input",
    "21/10/2026",
    "20/10/2026",
    ["detail-0-f3-end"],
  );
  assert.equal(await start.getAttribute("aria-invalid"), "false");
  const error = page.locator("#detail-0-f3-end-error");
  const errorText = await error.textContent();
  assert.equal(await error.getAttribute("title"), errorText);
  assert.equal(
    await error.evaluate((e) => getComputedStyle(e).textOverflow),
    "ellipsis",
  );
  assert(await error.evaluate((e) => e.scrollWidth > e.clientWidth));
  record("long-validation-ellipsis-with-full-title-and-input-description", {
    error: errorText,
  });
  const longTitle =
    "TEST_DATE_14134_" + Date.now() + " " + "Kiểm tra nội dung dài ".repeat(10);
  await page.locator("#create-title").fill(longTitle);
  await page.locator("#create-title").blur();
  assert.equal(
    await page.locator("#create-title").getAttribute("title"),
    longTitle,
  );
  assert.equal(
    await page
      .locator("#create-title")
      .evaluate((e) => getComputedStyle(e).textOverflow),
    "ellipsis",
  );
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page.screenshot({ path: `/tmp/ticket-clone-dates-${width}.png` });
    record("ellipsis-and-contained-horizontal-detail-scroll-" + width);
  }
  await start.fill("20/10/2026");
  await end.fill("20/10/2026");
  await page
    .getByRole("button", { name: "Sao chép dòng 1", exact: true })
    .click();
  await page.locator("#detail-1-f3-end").fill("21/10/2026");
  await page.locator("#create-title").fill("TEST_DATE_14134_" + Date.now());
  const responsePromise = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/ticket_manager" &&
      r.request().method() === "POST",
  );
  await submit.click();
  const response = await responsePromise;
  assert(response.ok());
  const created = await response.json();
  assert(created.id);
  report.created = { id: created.id };
  save();
  await page.waitForURL("**/requests");
  assert.equal(writes, 1);
  const saved = await get("/ticket_manager/" + created.id);
  report.created.code = saved.ticket_code;
  const ranges = saved.data_item.dataform.data.map(
    (row) => row["Thời gian đào tạo"],
  );
  assert.deepEqual(ranges, [
    "20/10/2026 - 20/10/2026",
    "20/10/2026 - 21/10/2026",
  ]);
  record("real-create-and-readback-preserves-same-day-and-increasing-ranges", {
    id: created.id,
    code: saved.ticket_code,
    ranges,
  });
  await page
    .getByRole("searchbox", { name: "Tìm kiếm yêu cầu", exact: true })
    .fill(saved.title);
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await page
    .getByRole("link", { name: saved.ticket_code, exact: true })
    .click();
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox")
    .fill("TEST kiểm tra validate ngày clone 14134 đã hoàn tất.");
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  const canceled = await get("/ticket_manager/" + created.id);
  assert.equal(canceled.ticket_status, 4);
  report.created.status = "Hủy";
  record("test-ticket-canceled-through-ui");
  const unchanged = await get("/ticket_manager/14134");
  assert.deepEqual(unchanged.data_item, source.data_item);
  assert.equal(unchanged.ticket_status, source.ticket_status);
  record("source-ticket-14134-unchanged");
  assert.deepEqual(report.runtimeErrors, []);
})()
  .catch((e) => {
    report.failure = e.message;
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    save();
    if (browser) await browser.close();
  });
