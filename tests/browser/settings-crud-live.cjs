// Real TEST writes through visible UI; credentials are read from stdin, never saved.
// Resume with the same SETTINGS_CRUD_REPORT. Only this run's fixtures may be updated.
// PLAYWRIGHT_MODULE/BROWSER_EXECUTABLE select existing local browser tooling.
// BASE_URL may point to the local TEST preview. Screenshots are not written.
process.env.TEST_ENV ??= "test";
const env = require("../env.cjs");
const fs = require("node:fs");
const path = require("node:path");
const { tmpdir } = require("node:os");
const { createHash } = require("node:crypto");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

assert.equal(
  process.env.TEST_ENV,
  "test",
  "Live settings writes require TEST_ENV=test",
);
assert.equal(new URL(env.apiUrl).host, "ticket-api.aiminds.io.vn");
assert(
  ["ticket-new.aiminds.io.vn", "127.0.0.1", "localhost"].includes(
    new URL(env.baseUrl).hostname,
  ),
);

const reportPath = path.resolve(
  process.env.SETTINGS_CRUD_REPORT || "tests/artifacts/settings-crud-live.json",
);
// Keep progress outside Vite's watched tree; publish the report after the run.
const progressPath = path.join(
  tmpdir(),
  `ticket-settings-crud-${createHash("sha256").update(reportPath).digest("hex").slice(0, 16)}.json`,
);
const resumePath = fs.existsSync(progressPath) ? progressPath : reportPath;
const state = fs.existsSync(resumePath)
  ? JSON.parse(fs.readFileSync(resumePath, "utf8"))
  : {
      prefix: `TESTCFG_${Date.now().toString(36).toUpperCase()}`,
      startedAt: new Date().toISOString(),
      fixtures: {},
      checks: [],
      writes: [],
      errors: [],
      blockedWrites: [],
    };
assert.match(state.prefix, /^TESTCFG_[A-Z0-9]+$/);
const save = () => {
  fs.writeFileSync(progressPath, JSON.stringify(state, null, 2) + "\n", {
    mode: 0o600,
  });
};
const publish = () => {
  save();
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.copyFileSync(progressPath, reportPath);
};
const config = {
  "requesting-departments": {
    label: "bộ phận sử dụng",
    endpoint: "/bophanmmanager/",
    suffix: "BP",
  },
  offices: { label: "văn phòng", endpoint: "/vanphongmanager/", suffix: "VP" },
  positions: { label: "chức vụ", endpoint: "/chucvumanager/", suffix: "CV" },
  teams: { label: "team", endpoint: "/teammanager/", suffix: "TEAM" },
  users: { label: "người dùng", endpoint: "/usermmanager/", suffix: "USER" },
  "handling-departments": {
    label: "bộ phận xử lý",
    endpoint: "/handlinggroupmmanager/",
    suffix: "XL",
  },
  "request-types": {
    label: "loại yêu cầu",
    endpoint: "/tickettypemmanager/",
    suffix: "TYPE",
  },
};
const name = (kind, updated = false) =>
  `${state.prefix}_${config[kind].suffix}${updated ? "_U" : ""}`;
const username = `${state.prefix.toLowerCase()}_user`;
const own = (kind) => {
  const row = state.fixtures[kind];
  assert(row?.id, `Create ${kind} first`);
  assert(
    String(row.username || row.name)
      .toLowerCase()
      .startsWith(state.prefix.toLowerCase()),
  );
  return row;
};
const sorted = (values) => [...values].sort((a, b) => a - b);

function pdfFile(suffix) {
  const text = `${state.prefix} ${suffix}`;
  const stream = `BT /F1 12 Tf 40 750 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(content));
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(content);
  content += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return {
    name: `${state.prefix}_${suffix}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(content),
  };
}

let browser;
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
  browser = await chromium.launch({
    headless: process.env.HEADLESS === "true",
    executablePath: process.env.BROWSER_EXECUTABLE,
    slowMo: Number(process.env.SLOW_MO || 120),
    args: ["--no-sandbox", "--start-maximized"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Ho_Chi_Minh",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on("pageerror", (error) => {
    state.errors.push(error.message);
    save();
  });
  page.on("dialog", async (dialog) => {
    state.browserDialogs ??= [];
    state.browserDialogs.push({
      type: dialog.type(),
      message: dialog.message(),
    });
    await dialog.accept();
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (
      request.method() === "GET" ||
      ["/api/token/", "/api/token/refresh/"].includes(pathname)
    )
      return route.continue();
    const entry = Object.entries(config).find(([, value]) =>
      pathname.startsWith(`/api${value.endpoint}`),
    );
    let allowed = false;
    if (entry) {
      const [kind, value] = entry;
      const id = pathname
        .slice(`/api${value.endpoint}`.length)
        .replace(/\/$/, "");
      allowed =
        request.method() === "POST"
          ? !id &&
            (request.postData() || "")
              .toLowerCase()
              .includes(state.prefix.toLowerCase())
          : request.method() === "PUT" && id === String(own(kind).id);
    } else if (pathname.startsWith("/api/template_form/")) {
      const body = request.postDataJSON();
      allowed =
        ["POST", "PUT"].includes(request.method()) &&
        body.ticket_type === own("request-types").id;
    }
    if (!allowed) {
      state.blockedWrites.push({ method: request.method(), path: pathname });
      save();
      return route.abort();
    }
    return route.continue();
  });
  const step = async (title, action) => {
    if (
      state.checks.some(
        (check) => check.name === title && check.status === "passed",
      )
    )
      return;
    const start = Date.now();
    try {
      const creationKind = {
        "create-department": "requesting-departments",
        "create-office": "offices",
        "create-position": "positions",
        "create-team": "teams",
        "create-user": "users",
        "create-handling-department": "handling-departments",
        "create-request-type-with-pdf": "request-types",
      }[title];
      if (creationKind && state.fixtures[creationKind]?.id) {
        const record = await get(
          config[creationKind].endpoint + own(creationKind).id,
        );
        assert.equal(record.id, own(creationKind).id);
        state.checks.push({
          name: title,
          status: "passed",
          id: record.id,
          recoveredExistingFixture: true,
        });
        return;
      }
      const details = await action();
      state.checks.push({
        name: title,
        status: "passed",
        elapsedMs: Date.now() - start,
        ...details,
      });
      console.log(`PASS ${title}`);
    } catch (error) {
      state.checks.push({
        name: title,
        status: "failed",
        error: error.message,
      });
      state.lastUiFailure = {
        url: page.url(),
        text: (
          await page
            .locator("main")
            .innerText()
            .catch(() => "")
        ).slice(0, 2500),
      };
      throw error;
    } finally {
      save();
    }
  };
  await page.goto(`${env.baseUrl}/login`);
  await page.bringToFront();
  await page.locator("#login-username").fill(credentials.username);
  await page.locator("#login-password").fill(credentials.password);
  const tokenResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/token/",
  );
  await page
    .getByRole("button", { name: "Sign In to Ticket", exact: true })
    .click();
  const { access } = await (await tokenResponse).json();
  assert(access);
  await page.waitForURL("**/requests");
  const get = async (endpoint) => {
    const response = await context.request.get(env.apiUrl + endpoint, {
      headers: { Authorization: `Bearer ${access}` },
    });
    assert(response.ok(), `Readback ${endpoint}: ${response.status()}`);
    return response.json();
  };
  const currentAccount = await get("/list_permission/");
  const currentUserId = Number(currentAccount.infoUser[0]);
  const manager = await get(`/usermmanager/${currentUserId}`);
  const managerName =
    [manager.last_name, manager.first_name].filter(Boolean).join(" ") ||
    manager.username;
  const permissions = await get("/list_position_permission/");
  const viewPermission = permissions.find(
    (permission) => permission.name === "can_view" && permission.is_active,
  )?.id;
  const createPermission = permissions.find(
    (permission) => permission.name === "can_create" && permission.is_active,
  )?.id;
  assert(viewPermission && createPermission);
  const dialog = () => page.getByRole("dialog");
  const waitReady = () =>
    page.waitForFunction(() =>
      [...document.querySelectorAll('[role="dialog"] button')].some(
        (button) => button.textContent.trim() === "Lưu" && !button.disabled,
      ),
    );
  const open = async (kind, editing = false, status = "") => {
    const keyword = editing ? own(kind).username || own(kind).name : "";
    await page.goto(
      `${env.baseUrl}/settings/${kind}?${new URLSearchParams({ search: keyword, ...(status ? { is_active: status } : {}) })}`,
    );
    await page
      .locator(
        `section[aria-label="Danh sách ${config[kind].label}"][aria-busy="false"]`,
      )
      .waitFor();
    await page
      .getByRole("button", {
        name: editing ? `Chỉnh sửa ${keyword}` : "Thêm mới",
        exact: true,
      })
      .click();
    await waitReady();
  };
  const field = (id) => dialog().locator(`#settings-${id}`);
  const select = async (label, option) => {
    await dialog().getByRole("combobox", { name: label, exact: true }).click();
    await page
      .getByRole("combobox", {
        name: `Tìm ${label.toLowerCase()}`,
        exact: true,
      })
      .fill(option);
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  const multi = async (label, option, selected) => {
    await dialog().getByRole("button", { name: label, exact: true }).click();
    const search = page.getByRole("searchbox", {
      name: `Search ${label.toLowerCase()}`,
      exact: true,
    });
    if (await search.count()) await search.fill(option);
    const button = page.getByRole("button", {
      name: option,
      exact: true,
    });
    if (((await button.getAttribute("aria-pressed")) === "true") !== selected)
      await button.click();
    await page.keyboard.press("Escape");
  };
  const active = async (value) => {
    const checkbox = dialog().getByRole("checkbox").first();
    if (((await checkbox.getAttribute("aria-checked")) === "true") !== value)
      await checkbox.click();
  };
  const submit = async (kind, editing, expected = {}) => {
    const endpoint =
      `/api${config[kind].endpoint}${editing ? own(kind).id : ""}`.replace(
        /\/$/,
        "",
      );
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.replace(/\/$/, "") === endpoint &&
        response.request().method() === (editing ? "PUT" : "POST"),
    );
    const permissionRefresh = [
      "positions",
      "users",
      "handling-departments",
    ].includes(kind)
      ? page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/list_permission/",
        )
      : null;
    await dialog().getByRole("button", { name: "Lưu", exact: true }).click();
    const response = await responsePromise;
    const result = await response.json();
    state.writes.push({
      kind,
      method: response.request().method(),
      path: new URL(response.url()).pathname,
      status: response.status(),
      id: result.id,
    });
    assert(response.ok(), `${kind} save failed: ${JSON.stringify(result)}`);
    assert(
      result.id,
      `${kind} save did not return a record: ${JSON.stringify(result)}`,
    );
    state.fixtures[kind] = result;
    save();
    await dialog().waitFor({ state: "hidden" });
    if (permissionRefresh) await permissionRefresh;
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const readback = await get(config[kind].endpoint + result.id);
    for (const [key, value] of Object.entries(expected))
      assert.deepEqual(
        Array.isArray(value) ? sorted(readback[key]) : readback[key],
        Array.isArray(value) ? sorted(value) : value,
        `${kind}.${key}`,
      );
    if (kind === "users")
      readback.name =
        [readback.last_name, readback.first_name].filter(Boolean).join(" ") ||
        readback.username;
    state.fixtures[kind] = readback;
    save();
    const label = readback.username || readback.name;
    const listUrl = `${env.baseUrl}/settings/${kind}?${new URLSearchParams({ search: label, is_active: String(readback.is_active) })}`;
    const editButton = page.getByRole("button", {
      name: `Chỉnh sửa ${label}`,
      exact: true,
    });
    try {
      await page.goto(listUrl, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!error.message.includes("ERR_ABORTED")) throw error;
      await page.goto(listUrl, { waitUntil: "domcontentloaded" });
    }
    await editButton.waitFor();
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!error.message.includes("ERR_ABORTED")) throw error;
      await page.goto(listUrl, { waitUntil: "domcontentloaded" });
    }
    await editButton.waitFor();
    return {
      id: result.id,
      expected,
      readbackVerified: true,
      visibleAfterReload: true,
    };
  };
  const basic = async (kind, editing = false) => {
    await open(kind, editing);
    await field("name").fill(name(kind, editing));
  };

  try {
    state.status = "running";
    state.method =
      "Real TEST writes through browser UI; authenticated GET and reload verification; only owned TESTCFG fixtures may be updated.";
    state.screenshotsSaved = false;
    state.frontend = env.baseUrl;
    state.backend = env.apiUrl;
    state.account = credentials.username;
    save();
    await step("create-department", async () => {
      await basic("requesting-departments");
      return submit("requesting-departments", false, {
        name: name("requesting-departments"),
        is_active: true,
      });
    });
    await step("create-office", async () => {
      await basic("offices");
      return submit("offices", false, { name: name("offices") });
    });
    await step("create-position", async () => {
      await basic("positions");
      await field("description").fill(`${state.prefix} initial position`);
      await multi("Quyền hạn", "Xem yêu cầu", true);
      return submit("positions", false, { permission: [viewPermission] });
    });
    await step("create-team", async () => {
      await basic("teams");
      await select("Department", own("requesting-departments").name);
      return submit("teams", false, {
        bophan: own("requesting-departments").id,
      });
    });
    await step("create-user", async () => {
      await open("users");
      for (const [key, value] of Object.entries({
        username,
        msnv: `QA${state.prefix.slice(8)}`,
        last_name: "TEST",
        first_name: state.prefix,
        email: `${username}@example.invalid`,
      }))
        await field(key).fill(value);
      await select("Department", own("requesting-departments").name);
      await select("Team", own("teams").name);
      await select("Chức vụ", own("positions").name);
      return submit("users", false, {
        username,
        team: own("teams").id,
        bophan: own("requesting-departments").id,
        chucvu: own("positions").id,
        is_superuser: false,
      });
    });
    await step("create-handling-department", async () => {
      await basic("handling-departments");
      await field("group_email").fill(
        `${state.prefix.toLowerCase()}@example.invalid`,
      );
      await field("description").fill(
        `${state.prefix} initial handling department`,
      );
      await select("Người quản lý", `${credentials.username} · ${managerName}`);
      await multi("Thành viên", `${username} · ${own("users").name}`, true);
      return submit("handling-departments", false, {
        is_manager: currentUserId,
        ls_member: [own("users").id],
      });
    });
    await step("create-request-type-with-pdf", async () => {
      await basic("request-types");
      await select("Bộ phận xử lý", own("handling-departments").name);
      await field("attachment").setInputFiles(pdfFile("guide_v1"));
      return submit("request-types", false, {
        handling_group: own("handling-departments").id,
      });
    });

    for (const kind of [
      "requesting-departments",
      "offices",
      "positions",
      "teams",
      "users",
      "handling-departments",
      "request-types",
    ]) {
      await step(`update-${kind}`, async () => {
        if (kind === "users") {
          await open(kind, true);
          assert(await field("msnv").isDisabled());
          await field("first_name").fill(`${state.prefix}_Updated`);
          await field("email").fill(`${username}.updated@example.invalid`);
          return submit(kind, true, {
            first_name: `${state.prefix}_Updated`,
            email: `${username}.updated@example.invalid`,
            msnv: own(kind).msnv,
          });
        }
        await basic(kind, true);
        const expected = { name: name(kind, true) };
        if (kind === "positions") {
          await field("description").fill(`${state.prefix} updated position`);
          await multi("Quyền hạn", "Tạo yêu cầu", true);
          expected.permission = sorted([viewPermission, createPermission]);
        }
        if (kind === "handling-departments") {
          await field("description").fill(
            `${state.prefix} updated handling department`,
          );
          await multi(
            "Thành viên",
            `${username} · ${own("users").name}`,
            false,
          );
          expected.ls_member = [];
        }
        if (kind === "request-types")
          await field("attachment").setInputFiles(pdfFile("guide_v2"));
        return submit(kind, true, expected);
      });
    }

    const openTemplate = async () => {
      const record = own("request-types");
      await page.goto(
        `${env.baseUrl}/settings/request-types?search=${encodeURIComponent(record.name)}`,
      );
      await page
        .getByRole("button", { name: `Biểu mẫu ${record.name}`, exact: true })
        .click();
      await dialog()
        .getByRole("form", { name: "Cấu hình biểu mẫu", exact: true })
        .waitFor();
    };
    const saveTemplate = async () => {
      const id = own("request-types").id;
      const pending = page.waitForResponse(
        (response) =>
          /\/api\/template_form\//.test(new URL(response.url()).pathname) &&
          ["POST", "PUT"].includes(response.request().method()),
      );
      await dialog()
        .getByRole("button", { name: "Lưu biểu mẫu", exact: true })
        .click();
      const response = await pending;
      assert(response.ok());
      state.writes.push({
        kind: "template",
        method: response.request().method(),
        id,
        status: response.status(),
      });
      save();
      await dialog().waitFor({ state: "hidden" });
      return get(`/template_form/${id}`);
    };
    await step("create-template-four-field-types", async () => {
      await openTemplate();
      await dialog()
        .getByRole("button", { name: "Thêm phần", exact: true })
        .click();
      await dialog()
        .getByRole("button", { name: "Mở rộng phần 1", exact: true })
        .click();
      await dialog()
        .locator("#template-group-0")
        .fill(`${state.prefix} General`);
      for (const [index, type] of [
        "Văn bản",
        "Số",
        "Ngày",
        "Khoảng ngày",
      ].entries()) {
        await dialog()
          .getByRole("button", { name: "Thêm trường", exact: true })
          .click();
        await dialog()
          .locator(`#template-0-${index}-title`)
          .fill(`${state.prefix} field${index}`);
        await dialog().locator(`#template-0-${index}-type`).click();
        await page.getByRole("option", { name: type, exact: true }).click();
      }
      await dialog()
        .locator('label[for="template-0-0-required"] [data-slot="checkbox"]')
        .click();
      const result = await saveTemplate();
      assert.deepEqual(
        result.forms[0].children.map((field) => field.type),
        ["text", "number", "date-text", "range-date-text"],
      );
      assert.equal(result.forms[0].children[0].required, true);
      return {
        fieldTypes: result.forms[0].children.map((field) => field.type),
        readbackVerified: true,
      };
    });
    await step("update-template-reorder-remove-add-and-flags", async () => {
      await openTemplate();
      await dialog()
        .getByRole("button", { name: "Mở rộng phần 1", exact: true })
        .click();
      await dialog()
        .locator("#template-group-0")
        .fill(`${state.prefix} Updated`);
      await dialog()
        .getByRole("button", { name: "Đưa trường 2 lên", exact: true })
        .click();
      await dialog()
        .getByRole("button", { name: "Xóa trường 4", exact: true })
        .click();
      await dialog()
        .locator('label[for="template-0-0-handling"] [data-slot="checkbox"]')
        .click();
      await dialog()
        .getByRole("button", { name: "Thêm phần", exact: true })
        .click();
      await dialog()
        .getByRole("button", { name: "Mở rộng phần 2", exact: true })
        .click();
      await dialog()
        .locator("#template-group-1")
        .fill(`${state.prefix} Handler`);
      await dialog()
        .locator('label[for="template-group-edit-1"] [data-slot="checkbox"]')
        .click();
      await dialog()
        .getByRole("button", { name: "Thêm trường", exact: true })
        .click();
      await dialog()
        .locator("#template-1-0-title")
        .fill(`${state.prefix} internal`);
      await dialog()
        .locator('label[for="template-1-0-status"] [data-slot="checkbox"]')
        .click();
      const result = await saveTemplate();
      assert.equal(result.forms[0].title, `${state.prefix} Updated`);
      assert.equal(result.forms[0].children.length, 3);
      assert.equal(result.forms[0].children[0].type, "number");
      assert.equal(result.forms[0].children[0].handling, true);
      assert.equal(result.forms.length, 2);
      assert.equal(result.forms[1].editable, false);
      assert.equal(result.forms[1].children[0].status, true);
      await openTemplate();
      await dialog()
        .getByRole("button", { name: "Mở rộng phần 1", exact: true })
        .click();
      assert.equal(
        await dialog().locator("#template-group-0").inputValue(),
        `${state.prefix} Updated`,
      );
      await dialog().getByRole("button", { name: "Hủy", exact: true }).click();
      return { readbackVerified: true, reopenedVerified: true };
    });
    await step("updated-pdf-download", async () => {
      const record = await get(
        config["request-types"].endpoint + own("request-types").id,
      );
      assert(record.attachment_file);
      const response = await context.request.get(
        new URL(record.attachment_file, env.apiUrl).href,
      );
      assert(response.ok());
      const body = await response.body();
      assert.equal(body.subarray(0, 5).toString(), "%PDF-");
      assert(body.toString().includes("guide_v2"));
      return { bytes: body.length, secondFilePersisted: true };
    });

    for (const kind of Object.keys(config)) {
      await step(`lock-unlock-${kind}`, async () => {
        await open(kind, true);
        await active(false);
        await submit(kind, true, { is_active: false });
        await open(kind, true, "false");
        assert.equal(
          await dialog()
            .getByRole("checkbox")
            .first()
            .getAttribute("aria-checked"),
          "false",
        );
        await active(true);
        await submit(kind, true, { is_active: true });
        return { id: own(kind).id, lockedAndReactivated: true };
      });
    }
    await step("export-users-with-created-fixture", async () => {
      await page.goto(`${env.baseUrl}/settings/users`);
      await page
        .getByRole("button", { name: "Xuất Excel", exact: true })
        .waitFor();
      const pending = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Xuất Excel", exact: true })
        .click();
      const download = await pending;
      const buffer = fs.readFileSync(await download.path());
      assert.equal(buffer.subarray(0, 2).toString(), "PK");
      const containsFixture =
        execFileSync(
          "python3",
          [
            "-c",
            "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(any(sys.argv[2].encode() in z.read(n) for n in z.namelist() if n.endswith('.xml')))",
            await download.path(),
            username,
          ],
          { encoding: "utf8" },
        ).trim() === "True";
      assert(
        containsFixture,
        "Export must contain the newly created test user",
      );
      return {
        bytes: buffer.length,
        filename: download.suggestedFilename(),
        containsCreatedUser: true,
      };
    });
    for (const kind of [
      "request-types",
      "handling-departments",
      "users",
      "teams",
      "positions",
      "offices",
      "requesting-departments",
    ]) {
      await step(`cleanup-lock-${kind}`, async () => {
        await open(kind, true);
        await active(false);
        return submit(kind, true, { is_active: false });
      });
    }
    await step("final-seven-fixtures-remain-locked", async () => {
      for (const kind of Object.keys(config)) {
        const record = await get(config[kind].endpoint + own(kind).id);
        assert.equal(record.id, own(kind).id);
        assert.equal(
          record.is_active,
          false,
          `${kind} final state must be locked`,
        );
      }
      return { records: Object.keys(config).length, allLocked: true };
    });
    const outcomes = [
      ...new Map(state.checks.map((check) => [check.name, check])).values(),
    ];
    state.summary = {
      scenariosPassed: outcomes.filter((check) => check.status === "passed")
        .length,
      scenariosFailed: outcomes.filter((check) => check.status === "failed")
        .length,
      createdRecords: Object.keys(state.fixtures).length,
      finalState:
        "All seven TEST fixtures locked; no delete action is available in the UI.",
      realWriteRequests: state.writes.length,
      runnerRetryAttempts: state.checks.filter(
        (check) => check.status === "failed",
      ).length,
    };
    state.finalOutcomes = outcomes;
    assert.equal(state.summary.scenariosFailed, 0);
    assert.equal(state.blockedWrites.length, 0);
    assert.equal(state.errors.length, 0);
    state.status = "passed";
    state.completedAt = new Date().toISOString();
    delete state.failure;
    save();
    console.log(`PASS complete: ${state.prefix}; report ${reportPath}`);
  } catch (error) {
    state.status = "failed";
    state.failure = error.message;
    save();
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    publish();
    if (process.env.KEEP_BROWSER_OPEN === "true") {
      console.log(
        "Browser left open for inspection. Configuration writes remain restricted to this run's fixtures.",
      );
      await new Promise((resolve) => browser.once("disconnected", resolve));
    } else await browser.close();
  }
})().catch(async (error) => {
  state.status = "failed";
  state.failure = error.message;
  publish();
  console.error(error.stack);
  process.exitCode = 1;
  if (browser) await browser.close();
});
