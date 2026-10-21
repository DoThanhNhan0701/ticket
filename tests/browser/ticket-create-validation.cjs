// Real-browser create validation. Pass {username,password} on stdin; never saves credentials.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { format, addDays, startOfToday } = require("date-fns");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:5189";
const api = process.env.API_URL || "https://ticket-api.aiminds.io.vn/api";
const reportPath =
  process.env.VALIDATION_REPORT ||
  "tests/artifacts/ticket-create-validation.json";
const prefix = "TEST_CREATE_VALIDATE_" + Date.now();
const artifacts = process.env.VALIDATION_ARTIFACTS || "/tmp/" + prefix;
fs.mkdirSync(artifacts, { recursive: true });
const report = {
  prefix,
  method:
    "UI login, selections, typing, calendar, file picker, submit and cancellation against real API; authenticated GET readback; no mocks or injected form state",
  checks: [],
  calls: [],
  runtimeErrors: [],
};
const persist = () =>
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
const record = (name, details = {}) => {
  report.checks.push({ name, ...details });
  persist();
  console.log(name);
};
const date = (offset) => format(addDays(startOfToday(), offset), "dd/MM/yyyy");
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
  let writes = 0,
    uploads = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") {
      const path = new URL(r.url()).pathname;
      if (path === "/api/ticket_manager") writes++;
      if (path === "/api/attachmentticketfile") uploads++;
    }
  });
  page.on("response", (r) => {
    const path = new URL(r.url()).pathname;
    if (
      /\/api\/(ticket_manager|template_form|cancel_ticket|attachmentticketfile|list_tickettype)/.test(
        path,
      )
    )
      report.calls.push({
        method: r.request().method(),
        path,
        status: r.status(),
      });
  });
  const invalid = async (id, expected = true) =>
    page.waitForFunction(
      ({ id, expected }) =>
        document.getElementById(id)?.getAttribute("aria-invalid") ===
        String(expected),
      { id, expected },
    );
  const choose = async (label, option) => {
    await page.getByRole("combobox", { name: label, exact: true }).click();
    const search = page.getByRole("combobox", {
      name: "Tìm " + label.toLowerCase(),
      exact: true,
    });
    // Search limits large production catalogs while preserving actual UI selection.
    await search.fill(option);
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  const submit = () =>
    page.getByRole("button", { name: "Tạo yêu cầu", exact: true }).click();
  const noWrites = () => {
    assert.equal(writes, 0);
    assert.equal(uploads, 0);
  };
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
    const r = await context.request.get(api + path, {
      headers: { Authorization: "Bearer " + access },
    });
    assert(r.ok());
    report.calls.push({
      method: "GET",
      path: "/api" + path,
      status: r.status(),
    });
    return r.json();
  };
  await page.getByRole("link", { name: "Tạo yêu cầu", exact: true }).click();
  const group = page.locator("#create-handling_group");
  await group.waitFor();
  await group.focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.getByRole("alert").count(), 0);
  record("no-premature-errors-before-first-submit");
  await submit();
  await invalid("create-handling_group");
  await invalid("create-approve_user");
  noWrites();
  record("empty-submit-required-selects-blocked");
  await choose("Bộ phận xử lý", "TEST_DVGMOTY6");
  await invalid("create-handling_group", false);
  await invalid("create-approve_user");
  await choose("Loại yêu cầu", "TEST_DETAIL_20261020_MVGMOTY6");
  await invalid("create-ticket_type", false);
  await choose("Người phê duyệt", "Nhan Nhan");
  await invalid("create-approve_user", false);
  record(
    "select-errors-clear-on-valid-selection-without-clearing-unrelated-errors",
  );
  await page.locator("#create-title").fill("   ");
  await invalid("create-title");
  await page.locator("#create-title").fill(prefix);
  await invalid("create-title", false);
  await choose("Department", "TEST_20261020_G3CCBK Dept OK");
  await choose("Văn phòng", "TEST_20261020_G3CCBK Office OK");
  const due = page.locator("#create-due-date");
  await due.fill(date(-1));
  await invalid("create-due-date");
  assert.equal(await page.locator("#detail-0-f0").count(), 0);
  await due.fill(date(0));
  await invalid("create-due-date", false);
  await page.locator("#detail-0-f0").waitFor();
  record("whitespace-title-and-past-due-date-correct-on-change");
  await page.locator("#detail-0-f0").fill("   ");
  await invalid("detail-0-f0");
  await page.locator("#detail-0-f0").fill(prefix + " Nội dung");
  await invalid("detail-0-f0", false);
  await invalid("detail-0-f1");
  await page.locator("#detail-0-f1").fill("0");
  await invalid("detail-0-f1", false);
  await page.locator("#detail-0-f0").fill("");
  await invalid("detail-0-f0");
  await page.locator("#detail-0-f0").fill(prefix + " Nội dung");
  await invalid("detail-0-f0", false);
  noWrites();
  record("detail-required-whitespace-zero-and-valid-to-invalid-transitions");
  await choose("Bộ phận xử lý", "HR");
  await invalid("create-ticket_type");
  assert.equal(await page.locator("#detail-0-f0").count(), 0);
  await choose("Loại yêu cầu", "Yêu cầu Đào tạo");
  await page.locator("#detail-0-f3-end").waitFor();
  await invalid("detail-0-f3-start");
  await invalid("detail-0-f3-end");
  record(
    "group-type-switch-removes-old-details-and-validates-current-template",
  );
  const fillTraining = async () => {
    for (const index of [0, 1, 2, 4, 5])
      await page
        .locator("#detail-0-f" + index)
        .fill(prefix + " trường " + index);
    await page.locator("#detail-0-f3-start").fill(date(0));
    await page.locator("#detail-0-f3-end").fill(date(0));
  };
  const start = page.locator("#detail-0-f3-start"),
    end = page.locator("#detail-0-f3-end");
  await start.fill(date(0));
  await invalid("detail-0-f3-start", false);
  await invalid("detail-0-f3-end");
  await fillTraining();
  await invalid("detail-0-f3-end", false);
  await page
    .locator("#create-description")
    .fill("Ghi chú cần giữ khi sửa ngày");
  const smallFile = {
    name: prefix + ".txt",
    mimeType: "text/plain",
    buffer: Buffer.from(prefix),
  };
  const filePicker = () =>
    page
      .locator('form[aria-label="Tạo yêu cầu mới"] input[type="file"]')
      .last();
  await filePicker().setInputFiles(smallFile);
  await end.fill(date(-1));
  await invalid("detail-0-f3-end");
  await start.fill(date(-2));
  await invalid("detail-0-f3-end", false);
  assert.equal(
    await page.locator("#create-description").inputValue(),
    "Ghi chú cần giữ khi sửa ngày",
  );
  await page
    .getByRole("button", { name: "Bỏ tệp " + smallFile.name, exact: true })
    .waitFor();
  record(
    "range-error-clears-when-only-other-endpoint-is-corrected-and-drafts-survive",
  );
  await start.fill(date(1));
  await invalid("detail-0-f3-end");
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await end.scrollIntoViewIfNeeded();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    const screenshot = artifacts + "/range-error-" + width + ".png";
    await page.screenshot({ path: screenshot });
    record("visible-date-error-" + width, { screenshot });
  }
  await end.fill(date(1));
  await invalid("detail-0-f3-end", false);
  await end.fill("21/10/202");
  await invalid("detail-0-f3-end");
  await end.fill(date(1));
  await invalid("detail-0-f3-end", false);
  record("unfinished-date-stays-invalid-until-complete");
  await page
    .getByRole("button", {
      name: "Choose thời gian đào tạo - đến ngày",
      exact: true,
    })
    .click();
  assert(
    await page
      .getByRole("button", {
        name: new RegExp(format(startOfToday(), "MMMM do, yyyy")),
      })
      .isDisabled(),
  );
  const day = page.getByRole("button", {
    name: new RegExp(format(addDays(startOfToday(), 1), "MMMM do, yyyy")),
  });
  assert(!(await day.isDisabled()));
  await day.click();
  record("calendar-blocks-before-start-and-allows-same-day");
  // Clicking the selected day clears it in single-selection mode.
  await invalid("detail-0-f3-end");
  await end.fill(date(1));
  await invalid("detail-0-f3-end", false);
  record("clearing-selected-calendar-day-revalidates-required-input");
  await page
    .getByRole("button", { name: "Sao chép dòng 1", exact: true })
    .click();
  await page.locator("#detail-1-f3-start").fill(date(2));
  await invalid("detail-1-f3-end");
  await invalid("detail-0-f3-end", false);
  await page.locator("#detail-1-f3-end").fill(date(2));
  await invalid("detail-1-f3-end", false);
  await page.getByRole("button", { name: "Thêm dòng", exact: true }).click();
  await invalid("detail-2-f0");
  await page.getByRole("button", { name: "Xóa dòng 3", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('[aria-invalid="true"]').length === 0,
  );
  record(
    "copied-rows-independent-and-deleting-invalid-row-clears-obsolete-errors",
  );
  const notes = page.locator("#create-description");
  await notes.fill("x".repeat(1001));
  await invalid("create-description");
  await notes.fill("x".repeat(1002));
  await invalid("create-description");
  await notes.fill("x".repeat(1000));
  await invalid("create-description", false);
  record(
    "notes-1000-limit-retains-invalid-error-and-clears-on-valid-correction",
  );
  const large = artifacts + "/too-large.txt";
  const fd = fs.openSync(large, "w");
  fs.ftruncateSync(fd, 50 * 1024 * 1024 + 1);
  fs.closeSync(fd);
  await filePicker().setInputFiles(large);
  await page.getByRole("alert").filter({ hasText: "vượt quá 50 MB" }).waitFor();
  await submit();
  noWrites();
  await page
    .getByRole("button", { name: "Bỏ tệp too-large.txt", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('[role="alert"]')].some((e) =>
        e.textContent.includes("vượt quá 50 MB"),
      ),
  );
  fs.unlinkSync(large);
  record(
    "real-oversized-file-blocks-before-create-and-error-clears-on-removal",
  );
  await page.getByRole("button", { name: "Làm lại", exact: true }).click();
  assert.equal(await page.getByRole("alert").count(), 0);
  await choose("Bộ phận xử lý", "HR");
  await choose("Loại yêu cầu", "Yêu cầu Đào tạo");
  await choose("Người phê duyệt", "Nhan Nhan");
  await page.locator("#create-title").fill("x".repeat(301));
  assert.equal((await page.locator("#create-title").inputValue()).length, 300);
  const title = prefix + " Tạo sau khi sửa validate";
  await page.locator("#create-title").fill("  " + title + "  ");
  await choose("Department", "TEST_20261020_G3CCBK Dept OK");
  await choose("Văn phòng", "TEST_20261020_G3CCBK Office OK");
  await page.locator("#detail-0-f0").blur();
  assert.equal(await page.getByRole("alert").count(), 0);
  await fillTraining();
  assert.equal(await notes.inputValue(), "");
  assert.equal(
    await page
      .getByRole("button", { name: "Bỏ tệp " + smallFile.name, exact: true })
      .count(),
    0,
  );
  record(
    "start-over-clears-errors-drafts-files-and-restores-validation-after-first-submit",
  );
  await notes.fill("  " + prefix + " Ghi chú cuối  ");
  await filePicker().setInputFiles(smallFile);
  await page
    .getByRole("button", { name: "Sao chép dòng 1", exact: true })
    .click();
  await page.locator("#detail-1-f3-end").fill(date(1));
  noWrites();
  const createdResponse = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/ticket_manager" &&
      r.request().method() === "POST",
  );
  await submit();
  const response = await createdResponse;
  assert(response.ok());
  const created = await response.json();
  assert(created.id);
  report.created = { id: created.id };
  persist();
  try {
    await page.waitForURL("**/requests");
    assert.equal(writes, 1);
    assert.equal(uploads, 1);
    const saved = await get("/ticket_manager/" + created.id);
    report.created.code = saved.ticket_code;
    assert.equal(saved.title, title);
    assert.equal(saved.description, prefix + " Ghi chú cuối");
    assert.deepEqual(
      saved.data_item.dataform.data.map((row) => row["Thời gian đào tạo"]),
      [date(0) + " - " + date(0), date(0) + " - " + date(1)],
    );
    record("single-real-create-upload-and-readback-after-corrections", {
      id: created.id,
      code: saved.ticket_code,
    });
  } finally {
    await page.goto(base + "/requests/" + created.id);
    await page.getByRole("button", { name: "Hủy", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox")
      .fill(prefix + " kiểm tra validate đã hoàn tất");
    await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    const saved = await get("/ticket_manager/" + created.id);
    assert.equal(saved.ticket_status, 4);
    report.created.status = "Hủy";
    record("test-ticket-canceled-through-ui");
  }
  assert.deepEqual(report.runtimeErrors, []);
})()
  .catch((e) => {
    report.failure = e.message;
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    persist();
    if (browser) await browser.close();
  });
