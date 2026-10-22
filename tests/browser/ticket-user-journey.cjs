const ticketTestEnv = require("../env.cjs");
// Browser-only live test. Supply { username: password } credentials through stdin.
// BASE_URL, PLAYWRIGHT_MODULE, BROWSER_EXECUTABLE, JOURNEY_REPORT and JOURNEY_ARTIFACTS are optional.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
const mode = process.argv[2] || "all";
const base = ticketTestEnv.baseUrl;
const reportPath = path.resolve(
  process.env.JOURNEY_REPORT || "tests/artifacts/ticket-user-journey.json",
);
const report = fs.existsSync(reportPath)
  ? JSON.parse(fs.readFileSync(reportPath, "utf8"))
  : {
      prefix: `TEST_UI_20261020_${Date.now().toString(36).toUpperCase()}`,
      method:
        "UI only: login forms, navigation, keyboard, clicks and visible results; no direct API calls or injected app state",
      tickets: [],
      checks: [],
      runtimeErrors: [],
      failedResponses: [],
      videos: [],
    };
const artifacts = process.env.JOURNEY_ARTIFACTS || `/tmp/${report.prefix}`;
fs.mkdirSync(artifacts, { recursive: true });
const persist = () => {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
};
const done = (name) => report.checks.some((check) => check.name === name);
const record = (name, details = {}) => {
  report.checks.push({ name, ...details });
  persist();
  console.log(JSON.stringify(report.checks.at(-1)));
};
const labels = {
  group: "TEST_DVGMOTY6",
  type: "TEST_DETAIL_20261020_MVGMOTY6",
  approver: "Nhan Nhan",
  department: "TEST_20261020_G3CCBK Dept OK",
  office: "TEST_20261020_G3CCBK Office OK",
  team: "TEST_20261020_G3CCBK Team OK",
};
const textFile = (suffix) => ({
  name: `${report.prefix}_${suffix}.txt`,
  mimeType: "text/plain",
  buffer: Buffer.from(`${report.prefix}: ${suffix}`),
});
const imageFile = {
  name: `${report.prefix}_image.png`,
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWQAAAABJRU5ErkJggg==",
    "base64",
  ),
};
let browser;
const pages = new Map();
async function screenshot(page, name) {
  const target = path.join(artifacts, `${name}.png`);
  await page.screenshot({ path: target });
  return target;
}
async function login(username) {
  if (pages.has(username)) return pages.get(username).page;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Ho_Chi_Minh",
    acceptDownloads: true,
    recordVideo: { dir: artifacts, size: { width: 1440, height: 1000 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => {
    report.runtimeErrors.push({ username, message: error.message });
    persist();
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/api/")) {
      report.failedResponses.push({
        username,
        path: new URL(response.url()).pathname,
        status: response.status(),
      });
      persist();
    }
  });
  pages.set(username, { context, page });
  await page.goto(`${base}/login`);
  await page.locator("#login-username").fill(username);
  await page.locator("#login-password").fill(credentials[username]);
  await page
    .getByRole("button", { name: "Sign In to Ticket", exact: true })
    .click();
  await page.waitForURL("**/requests");
  await page
    .getByRole("heading", { name: "Danh sách yêu cầu", exact: true })
    .waitFor();
  record(`login-ui-${username}`, {
    screenshot: await screenshot(page, `login-${username}-${mode}`),
  });
  return page;
}
async function navigateList(page, group, label) {
  let root = page;
  const menu = page.getByRole("button", {
    name: "Mở menu điều hướng",
    exact: true,
  });
  if (await menu.isVisible()) {
    await menu.click();
    root = page.getByRole("dialog");
  }
  const link = root.getByRole("link", { name: label, exact: true });
  const section = root.locator("details").filter({
    has: page.locator("summary").filter({ hasText: group }),
  });
  if ((await section.getAttribute("open")) === null) {
    await section.locator("summary").click();
  }
  await link.click();
  await page
    .getByRole("searchbox", { name: "Tìm kiếm yêu cầu", exact: true })
    .waitFor();
}
async function search(page, value) {
  await page
    .getByRole("searchbox", { name: "Tìm kiếm yêu cầu", exact: true })
    .fill(value);
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
}
async function openTicket(username, ticket, scope = "all") {
  const page = await login(username);
  if (scope === "created" || username === "nhandt01")
    await navigateList(page, "Yêu cầu", "Danh sách yêu cầu");
  else if (scope === "pending")
    await navigateList(page, "Danh sách phê duyệt", "Chờ phê duyệt");
  else if (username === "nhandt02")
    await navigateList(page, "Nhiệm vụ của tôi", "Tất cả nhiệm vụ");
  else await navigateList(page, "Yêu cầu", "Tất cả yêu cầu");
  await search(page, ticket.title);
  await page.getByRole("link", { name: ticket.code, exact: true }).click();
  await page
    .getByRole("tab", { name: "Thông tin chung", exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Thông tin chung", exact: true }).click();
  return page;
}
async function choose(page, label, option) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function multi(page, label, option) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page
    .getByRole("button", { name: option, exact: true, pressed: false })
    .click();
  await page.keyboard.press("Escape");
}
async function tab(page, name) {
  const target = page.getByRole("tab", { name: new RegExp(`^${name}`) });
  await target.click();
  await page.waitForFunction(
    (id) =>
      document.getElementById(id)?.getAttribute("aria-selected") === "true",
    await target.getAttribute("id"),
  );
  await page.getByRole("tabpanel").waitFor();
}
async function status(page, value) {
  await page.getByText(value, { exact: true }).first().waitFor();
}
async function action(username, ticket, name, tag, fill, expected, scope) {
  if (done(tag)) return;
  const page = await openTicket(username, ticket, scope);
  await page.getByRole("button", { name, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  if (fill) await fill(page, dialog);
  else if (await dialog.getByRole("textbox").count())
    await dialog.getByRole("textbox").fill(`${report.prefix}: ${tag}`);
  await dialog.getByRole("button", { name, exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  if (expected) await status(page, expected);
  await page.reload();
  await page
    .getByRole("tab", { name: "Thông tin chung", exact: true })
    .waitFor();
  if (expected) await status(page, expected);
  record(tag, {
    username,
    ticket: ticket.code,
    screenshot: await screenshot(page, tag),
  });
}
async function create() {
  const existing = report.tickets.find((ticket) => ticket.scenario === "main");
  if (existing) {
    if (!done("create-submit-list-open-reload")) {
      const page = await openTicket("nhandt01", existing, "created");
      await status(page, "Mới tạo");
      await page.reload();
      await status(page, "Mới tạo");
      record("create-submit-list-open-reload", {
        ...existing,
        screenshot: await screenshot(page, "ticket-created"),
      });
    }
    return;
  }
  const page = await login("nhandt01");
  await page.getByRole("link", { name: "Tạo yêu cầu", exact: true }).click();
  await page
    .getByRole("heading", { name: "Tạo yêu cầu", exact: true })
    .waitFor();
  await choose(page, "Bộ phận xử lý", labels.group);
  await choose(page, "Loại yêu cầu", labels.type);
  await choose(page, "Người phê duyệt", labels.approver);
  await choose(page, "Công ty", "Rainscales VN");
  const title = `${report.prefix} Người dùng tạo mới`;
  await page
    .getByRole("textbox", { name: "Tiêu đề yêu cầu", exact: true })
    .fill(title);
  await choose(page, "Department", labels.department);
  await choose(page, "Văn phòng", labels.office);
  await multi(page, "Team sử dụng", labels.team);
  await page.getByRole("button", { name: "Tạo yêu cầu", exact: true }).click();
  await page.getByText("Vui lòng nhập Nội dung.", { exact: true }).waitFor();
  record("create-required-fields-visible-error");
  await page.locator("#detail-0-f0").fill(`${report.prefix} Nhập từ giao diện`);
  await page.locator("#detail-0-f1").fill("2");
  await page
    .getByRole("button", { name: "Sao chép dòng 1", exact: true })
    .click();
  assert.equal(await page.locator("#detail-1-f1").inputValue(), "2");
  await page.getByRole("button", { name: "Xóa dòng 2", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Ghi chú", exact: true })
    .fill(`${report.prefix} Ghi chú người dùng`);
  await page
    .locator('form[aria-label="Tạo yêu cầu mới"] input[type=file]')
    .last()
    .setInputFiles([textFile("create"), imageFile]);
  await page
    .getByRole("button", { name: `Xem ảnh ${imageFile.name}`, exact: true })
    .click();
  await page.getByRole("dialog").getByRole("img").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  record("create-copy-remove-row-and-preview-files", {
    screenshot: await screenshot(page, "create-filled"),
  });
  await page.getByRole("button", { name: "Tạo yêu cầu", exact: true }).click();
  await page.waitForURL("**/requests");
  await search(page, title);
  const titleLink = page.getByRole("link", { name: title, exact: true });
  await titleLink.waitFor();
  const row = page.getByRole("row").filter({ has: titleLink });
  const codeLink = row.getByRole("link").first();
  const ticket = {
    scenario: "main",
    title,
    code: await codeLink.innerText(),
    href: await codeLink.getAttribute("href"),
  };
  report.tickets.push(ticket);
  persist();
  await codeLink.click();
  await status(page, "Mới tạo");
  assert.equal(
    await page
      .getByRole("textbox", { name: "Tiêu đề yêu cầu", exact: true })
      .inputValue(),
    title,
  );
  await page
    .getByRole("link", { name: textFile("create").name, exact: true })
    .waitFor();
  await page.reload();
  await status(page, "Mới tạo");
  record("create-submit-list-open-reload", {
    ...ticket,
    screenshot: await screenshot(page, "ticket-created"),
  });
}
async function discussion(ticket) {
  if (done("discussion-edit-reply-and-comment")) return;
  const page = await openTicket("nhandt01", ticket, "created");
  await tab(page, "Trao đổi");
  const composer = page.getByRole("form", {
    name: "Phản hồi mới",
    exact: true,
  });
  await composer
    .getByLabel("Phản hồi", { exact: true })
    .fill(`${report.prefix} Bình luận đầu`);
  await composer
    .locator('input[type="file"]')
    .setInputFiles(textFile("comment"));
  await composer
    .getByRole("button", { name: "Gửi phản hồi", exact: true })
    .click();
  const comment = page
    .getByRole("article")
    .filter({ hasText: `${report.prefix} Bình luận đầu` });
  await comment.waitFor();
  await comment.hover();
  await comment.getByRole("button", { name: "Trả lời", exact: true }).click();
  const reply = page.getByRole("form", {
    name: "Trả lời nhandt01 mới",
    exact: true,
  });
  await reply.getByRole("textbox").fill(`${report.prefix} Trả lời đầu`);
  await reply.locator('input[type="file"]').setInputFiles(textFile("reply"));
  await reply
    .getByRole("button", { name: "Gửi phản hồi", exact: true })
    .click();
  await page
    .getByRole("article")
    .filter({ hasText: `${report.prefix} Trả lời đầu` })
    .waitFor();
  for (const [before, after, file] of [
    ["Bình luận đầu", "Bình luận đã sửa", "comment"],
    ["Trả lời đầu", "Trả lời đã sửa", "reply"],
  ]) {
    const message = page
      .getByRole("article")
      .filter({ hasText: `${report.prefix} ${before}` });
    await message.hover();
    await message
      .getByRole("button", {
        name: "Chỉnh sửa phản hồi của nhandt01",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Chỉnh sửa bình luận",
      exact: true,
    });
    await dialog.getByRole("textbox").fill(`${report.prefix} ${after}`);
    await dialog
      .getByRole("button", {
        name: `Bỏ tệp cũ ${textFile(file).name}`,
        exact: true,
      })
      .click();
    await dialog
      .getByRole("button", { name: "Lưu thay đổi", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
    await page
      .getByRole("article")
      .filter({ hasText: `${report.prefix} ${after}` })
      .waitFor();
  }
  await page.reload();
  await page
    .getByText(`${report.prefix} Bình luận đã sửa`, { exact: true })
    .waitFor();
  await page
    .getByText(`${report.prefix} Trả lời đã sửa`, { exact: true })
    .waitFor();
  record("discussion-edit-reply-and-comment", {
    screenshot: await screenshot(page, "discussion-saved"),
  });
}
async function processing(ticket) {
  await action(
    "nhandt02",
    ticket,
    "Phê duyệt",
    "approve-from-pending-list",
    null,
    "Đã duyệt",
    "pending",
  );
  await action(
    "admin",
    ticket,
    "Tiếp nhận",
    "receive-from-all-list",
    null,
    "Đang xử lý",
  );
  if (!done("detail-edit-date-upload")) {
    const page = await openTicket("admin", ticket);
    await page
      .getByRole("button", { name: "Đổi ngày mong muốn", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Ngày mong muốn", exact: true })
      .fill("30/11/2026");
    await page
      .getByRole("button", { name: "Lưu ngày mong muốn", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Đổi ngày mong muốn", exact: true })
      .waitFor();
    await page
      .getByRole("tabpanel")
      .locator('input[type="file"]')
      .setInputFiles(textFile("detail"));
    await page
      .getByRole("button", { name: "Tải lên đính kèm", exact: true })
      .click();
    await page
      .getByRole("link", { name: textFile("detail").name, exact: true })
      .waitFor();
    await tab(page, "Chi tiết yêu cầu");
    await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
    await page
      .locator("#detail-0-f2")
      .fill(`${report.prefix} Đã xử lý từ giao diện`);
    await page.locator("#detail-0-f3").fill("30/10/2026");
    await page
      .getByRole("button", { name: "Lưu thay đổi", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Chỉnh sửa", exact: true })
      .waitFor();
    await page.reload();
    await page
      .getByText(`${report.prefix} Đã xử lý từ giao diện`, { exact: true })
      .waitFor();
    await tab(page, "Thông tin chung");
    assert.equal(
      await page
        .getByRole("textbox", { name: "Ngày mong muốn", exact: true })
        .inputValue(),
      "30/11/2026",
    );
    record("detail-edit-date-upload", {
      screenshot: await screenshot(page, "general-updated"),
    });
  }
  await action("admin", ticket, "Phân công", "assignment-add", (page) =>
    multi(page, "Người nhận xử lý", "nhandt01"),
  );
  await action(
    "admin",
    ticket,
    "Phân công",
    "assignment-change",
    async (page, dialog) => {
      await choose(page, "Loại phân công", "Thay đổi người xử lý");
      await choose(page, "Người đang xử lý", "nhandt01");
      await choose(page, "Người nhận xử lý mới", "nhandt02");
      await dialog
        .getByRole("textbox")
        .fill(`${report.prefix} Đổi người xử lý`);
    },
  );
  await action("admin", ticket, "Phân công", "assignment-add-again", (page) =>
    multi(page, "Người nhận xử lý", "nhandt01"),
  );
  await action(
    "admin",
    ticket,
    "Phân công",
    "assignment-delete",
    async (page, dialog) => {
      await choose(page, "Loại phân công", "Xóa người xử lý");
      await multi(page, "Người cần xóa khỏi yêu cầu", "nhandt01");
      await dialog
        .getByRole("textbox")
        .fill(`${report.prefix} Xóa người xử lý`);
    },
  );
  if (!done("forward")) {
    const page = await openTicket("admin", ticket);
    await page.getByRole("button", { name: "Hoàn thành", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Chuyển tiếp", exact: true })
      .click();
    await choose(page, "Người nhận chuyển tiếp", "nhandt01");
    await dialog
      .getByRole("button", { name: "Chuyển tiếp", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
    await page.reload();
    assert(
      (
        await page
          .getByRole("textbox", { name: "Người xử lý", exact: true })
          .inputValue()
      ).includes("nhandt01"),
    );
    record("forward", { screenshot: await screenshot(page, "forwarded") });
  }
}
async function lifecycle(ticket) {
  for (const username of ["admin", "nhandt02", "nhandt01"])
    await action(
      username,
      ticket,
      "Hoàn thành",
      `done-${username}`,
      null,
      username === "nhandt01" ? "Hoàn thành" : "Đang xử lý",
    );
  await action(
    "nhandt01",
    ticket,
    "Xử lý lại",
    "reopen-with-reason",
    null,
    "Xử lý lại",
    "created",
  );
  await action(
    "nhandt02",
    ticket,
    "Hoàn thành",
    "decline-reprocessing-with-reason",
    null,
    "Hoàn thành",
  );
  await action(
    "nhandt01",
    ticket,
    "Xử lý lại",
    "reopen-second-time",
    null,
    "Xử lý lại",
    "created",
  );
  await action(
    "nhandt02",
    ticket,
    "Tiếp nhận",
    "receive-reopened",
    null,
    "Đang xử lý",
  );
  await action(
    "nhandt02",
    ticket,
    "Hoàn thành",
    "finish-reopened",
    null,
    "Hoàn thành",
  );
  await action("nhandt01", ticket, "Đóng", "close", null, "Đóng", "created");
}
async function cloneAndCancel(ticket) {
  let clone = report.tickets.find((item) => item.scenario === "clone");
  if (!clone) {
    const page = await openTicket("nhandt01", ticket, "created");
    await page.getByRole("button", { name: "Sao chép", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Tiêu đề yêu cầu", exact: true })
      .waitFor();
    await page.locator("#detail-0-f0").waitFor();
    assert.equal(
      await page.locator("#detail-0-f0").inputValue(),
      `${report.prefix} Nhập từ giao diện`,
    );
    const title = `${report.prefix} Bản sao để hủy`;
    await page
      .getByRole("textbox", { name: "Tiêu đề yêu cầu", exact: true })
      .fill(title);
    await page
      .getByRole("button", { name: "Tạo yêu cầu", exact: true })
      .click();
    await page.waitForURL("**/requests");
    await search(page, title);
    const row = page
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: title, exact: true }) });
    const link = row.getByRole("link").first();
    await link.waitFor();
    clone = {
      scenario: "clone",
      title,
      code: await link.innerText(),
      href: await link.getAttribute("href"),
    };
    report.tickets.push(clone);
    persist();
    record("clone-created-through-form", clone);
  }
  await action(
    "nhandt01",
    clone,
    "Hủy",
    "cancel-with-reason-and-file",
    async (page, dialog) => {
      await dialog
        .getByRole("textbox")
        .fill(`${report.prefix} Hủy bản sao kiểm thử`);
      await dialog
        .locator('input[type="file"]')
        .setInputFiles(textFile("cancel"));
    },
    "Hủy",
    "created",
  );
}
async function navigationAndMedia(ticket) {
  if (done("navigation-and-saved-media")) return;
  const page = await openTicket("nhandt01", ticket, "created");
  await tab(page, "Lịch sử");
  await page.getByRole("button", { name: "Quay lại", exact: true }).click();
  const input = page.getByRole("searchbox", {
    name: "Tìm kiếm yêu cầu",
    exact: true,
  });
  await input.waitFor();
  assert.equal(await input.inputValue(), ticket.title);
  await page.getByRole("link", { name: ticket.code, exact: true }).click();
  await page.getByRole("button", { name: imageFile.name, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("img").waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[role="dialog"] img')].some(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
  await screenshot(page, "saved-image-preview");
  await dialog
    .getByRole("button", { name: "Đóng xem trước ảnh", exact: true })
    .click();
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("link", { name: textFile("create").name, exact: true })
    .click();
  const popup = await popupPromise;
  await popup.getByText(`${report.prefix}: create`, { exact: true }).waitFor();
  await screenshot(popup, "opened-text-file");
  await popup.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Mở menu điều hướng", exact: true })
    .click();
  await screenshot(page, "mobile-navigation-menu");
  await page
    .getByRole("link", { name: "Danh sách yêu cầu", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Danh sách yêu cầu", exact: true })
    .waitFor();
  await search(page, ticket.title);
  await page.getByRole("link", { name: ticket.code, exact: true }).click();
  await status(page, "Đóng");
  record("navigation-and-saved-media", {
    backRestoresSearch: true,
    savedImageLoaded: true,
    fileOpenedInNewTab: true,
    mobileMenuNavigation: true,
    screenshot: await screenshot(page, "mobile-reopened-ticket"),
  });
}
async function mobile(ticket) {
  if (done("mobile-320-390-768-and-desktop")) return;
  const page = await openTicket("nhandt01", ticket, "created");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const name of [
      "Thông tin chung",
      "Chi tiết yêu cầu",
      "Trao đổi",
      "Lịch sử",
    ]) {
      await tab(page, name);
      // DOM inspection only; all navigation and changes use normal UI controls.
      const size = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        main: document.querySelector("main").clientWidth,
        scroll: document.querySelector("main").scrollWidth,
      }));
      assert(
        size.document <= width + 1 && size.scroll <= size.main + 1,
        JSON.stringify({ name, width, size }),
      );
    }
    record(`layout-${width}`, {
      screenshot: await screenshot(page, `layout-${width}`),
    });
  }
  record("mobile-320-390-768-and-desktop");
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await page.waitForURL("**/login");
  record("logout-ui");
}
(async () => {
  browser = await chromium.launch({
    headless: true,
    slowMo: 35,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {}),
  });
  try {
    if (mode === "menu") {
      const page = await login("nhandt02");
      const section = page.locator("details").filter({
        has: page.locator("summary").filter({ hasText: "Nhiệm vụ của tôi" }),
      });
      const summary = section.locator("summary");
      const before = await section.getAttribute("open");
      await summary.click();
      const clicked = await section.getAttribute("open");
      await page.waitForTimeout(1000);
      const settled = await section.getAttribute("open");
      await summary.press("Enter");
      await page.waitForTimeout(1000);
      record("menu-pointer-and-keyboard", {
        before,
        clicked,
        settled,
        keyboard: await section.getAttribute("open"),
        url: page.url(),
        screenshot: await screenshot(page, "menu-debug"),
      });
      return;
    }
    if (["all", "create"].includes(mode)) await create();
    const ticket = report.tickets.find((item) => item.scenario === "main");
    assert(ticket, "Create a test ticket through the UI first.");
    if (["all", "discussion"].includes(mode)) await discussion(ticket);
    if (["all", "processing"].includes(mode)) await processing(ticket);
    if (["all", "lifecycle"].includes(mode)) await lifecycle(ticket);
    if (["all", "clone"].includes(mode)) await cloneAndCancel(ticket);
    if (["all", "navigation"].includes(mode)) await navigationAndMedia(ticket);
    if (["all", "mobile"].includes(mode)) await mobile(ticket);
    delete report.failure;
    record(`phase-${mode}-passed`);
  } catch (error) {
    report.failure = error.message;
    for (const [username, { page }] of pages)
      await screenshot(page, `failure-${mode}-${username}`).catch(
        () => undefined,
      );
    persist();
    throw error;
  } finally {
    for (const [username, { context, page }] of pages) {
      const video = page.video();
      await context.close();
      if (video)
        report.videos.push({ username, phase: mode, path: await video.path() });
    }
    persist();
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
