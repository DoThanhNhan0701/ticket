// UI-only QC sweep. Credentials {username,password} arrive on stdin.
// Modes: inventory (read only), run (create one TEST ticket per selectable type).
// Resume uses CATALOG_REPORT; successful creations are never submitted twice.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { format, addDays, startOfToday } = require("date-fns");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const mode = process.argv[2] || "inventory";
const base = process.env.BASE_URL || "http://127.0.0.1:5189";
const reportPath =
  process.env.CATALOG_REPORT || "tests/artifacts/ticket-create-catalog.json";
const report = fs.existsSync(reportPath)
  ? JSON.parse(fs.readFileSync(reportPath, "utf8"))
  : {
      prefix: "TEST_QC_CREATE_" + format(new Date(), "yyyyMMdd_HHmmss"),
      method:
        "Browser UI only: login, open every handling group/type selector, fill fields, add/copy up to five detail rows, submit, search list and open created ticket for readback. Network responses are observed for evidence only; no direct API calls, mocks, injected state or lifecycle mutations.",
      groups: [],
      results: [],
      runtimeErrors: [],
      failedResponses: [],
    };
const artifacts = process.env.CATALOG_ARTIFACTS || "/tmp/" + report.prefix;
fs.mkdirSync(artifacts, { recursive: true });
const persist = () =>
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
const {
  clean,
  plannedDates,
  fieldValue,
} = require("./ticket-create-catalog-data.cjs");
const dump = (event, details) =>
  console.log(JSON.stringify({ event, ...details }));
const templates = new Map();
const typeCatalogs = new Map();
const pending = new Set();
let browser,
  page,
  current,
  activeGroups = [];
let createRequests = 0;
const snapshot = async (name) => {
  const path = artifacts + "/" + name + ".png";
  await page.screenshot({ path });
  return path;
};
async function choose(label, text, occurrence = 0) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page
    .getByRole("combobox", { name: "Tìm " + label.toLowerCase(), exact: true })
    .fill(text);
  await page
    .getByRole("option", { name: text, exact: true })
    .nth(occurrence)
    .click();
}
async function options(label) {
  const trigger = page.getByRole("combobox", { name: label, exact: true });
  await trigger.click();
  await page.getByRole("listbox").waitFor();
  const labels = await page.getByRole("option").allTextContents();
  await page.keyboard.press("Escape");
  return labels.map((text) => text.trim());
}
async function selectedId(label) {
  return page
    .getByRole("combobox", { name: label, exact: true })
    .evaluate(
      (e) => e.closest('[data-slot="field"]').querySelector("input")?.value,
    );
}
async function flush() {
  await Promise.all([...pending]);
}
async function openCreate() {
  if (!/\/requests(?:\?.*)?$/.test(page.url())) {
    const back = page.getByRole("button", {
      name: "Quay lại danh sách",
      exact: true,
    });
    if (await back.isVisible()) await back.click();
    else if (
      await page
        .getByRole("button", { name: "Quay lại", exact: true })
        .isVisible()
    )
      await page.getByRole("button", { name: "Quay lại", exact: true }).click();
    else
      await page
        .getByRole("link", { name: "Danh sách yêu cầu", exact: true })
        .click();
  }
  await page.getByRole("link", { name: "Tạo yêu cầu", exact: true }).click();
  await page.locator("#create-handling_group").waitFor();
  await page
    .getByRole("button", { name: "Tạo yêu cầu", exact: true })
    .waitFor();
}
async function waitTypeCatalog(groupId) {
  await page.waitForFunction(
    () =>
      !document.querySelector("form")?.getAttribute("aria-busy") ||
      document.querySelector("form")?.getAttribute("aria-busy") === "false",
  );
  for (let attempt = 0; attempt < 50; attempt++) {
    await flush();
    if (typeCatalogs.has(groupId)) return typeCatalogs.get(groupId);
    await page.waitForTimeout(100);
  }
  throw Error("Type catalog did not arrive for group " + groupId);
}
async function inventory() {
  await openCreate();
  report.visibleGroupLabels = await options("Bộ phận xử lý");
  await flush();
  assert(activeGroups.length, "No group data observed from UI");
  const occurrences = new Map();
  for (const group of activeGroups) {
    const occurrence = occurrences.get(group.name) || 0;
    occurrences.set(group.name, occurrence + 1);
    await choose("Bộ phận xử lý", group.name, occurrence);
    assert.equal(Number(await selectedId("Bộ phận xử lý")), group.id);
    const records = await waitTypeCatalog(group.id);
    const active = records.filter(
      (type) => type.is_active && Number(type.handling_group) === group.id,
    );
    let visible = [];
    if (active.length) {
      await page.waitForFunction(
        () =>
          !document
            .getElementById("create-ticket_type")
            ?.hasAttribute("disabled"),
      );
      visible = await options("Loại yêu cầu");
      assert.deepEqual(
        [...visible].sort(),
        active.map((type) => type.name).sort(),
      );
    }
    const item = {
      id: group.id,
      name: group.name,
      occurrence,
      types: active.map((type) => ({ id: type.id, name: type.name })),
      inactiveTypes: records
        .filter((type) => !type.is_active)
        .map((type) => ({ id: type.id, name: type.name })),
      visibleOptions: visible.length,
    };
    const index = report.groups.findIndex((row) => row.id === group.id);
    if (index < 0) report.groups.push(item);
    else report.groups[index] = item;
    persist();
    dump("inventory", {
      group: group.name,
      activeTypes: active.length,
      inactiveTypes: item.inactiveTypes.length,
    });
  }
  report.inventory = {
    groups: report.groups.length,
    activeTypes: report.groups.reduce(
      (total, group) => total + group.types.length,
      0,
    ),
    inactiveTypes: report.groups.reduce(
      (total, group) => total + group.inactiveTypes.length,
      0,
    ),
  };
  persist();
  dump("inventory-complete", report.inventory);
}
async function fillRow(index, fields, offsets) {
  for (const [column, field] of fields.entries()) {
    const id = "detail-" + index + "-f" + column;
    const label = clean(field.title);
    const value = fieldValue(field, index, offsets);
    if (field.option?.length) {
      const target = page.locator("#" + id);
      await target.click();
      const search = page.getByRole("combobox", {
        name: "Tìm " + label.toLowerCase(),
        exact: true,
      });
      await search.fill(value);
      await page
        .getByRole("option", {
          name: value,
          exact: true,
        })
        .first()
        .click();
    } else if (field.type.includes("date")) {
      const date = value;
      if (field.type === "range-date-text") {
        await page.locator("#" + id + "-start").fill(date);
        await page.locator("#" + id + "-end").fill(date);
      } else await page.locator("#" + id).fill(date);
    } else await page.locator("#" + id).fill(value);
  }
}
async function verifyCreated(result) {
  await page
    .getByRole("searchbox", { name: "Tìm kiếm yêu cầu", exact: true })
    .fill(result.title);
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  const row = page.getByRole("row").filter({
    has: page.getByRole("link", { name: result.title, exact: true }),
  });
  await row.waitFor();
  assert.equal(await row.count(), 1);
  const link = row.getByRole("link").first();
  result.code = await link.innerText();
  await link.click();
  await page
    .getByRole("tab", { name: "Chi tiết yêu cầu", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.getElementById("ticket-tab-1")?.getAttribute("aria-selected") ===
      "true",
  );
  const panel = page.locator("#ticket-panel-1");
  await panel.waitFor();
  const counts = await panel
    .locator("table tbody")
    .evaluateAll((bodies) => bodies.map((body) => body.children.length));
  if (result.hasCreationDetails)
    assert(
      counts.length && counts.every((count) => count === 5),
      "Saved detail tables must each contain exactly five rows",
    );
  result.detailTableRows = counts;
  result.createdScreenshot = await snapshot(
    "type-" + result.typeId + "-created",
  );
  result.status = "passed";
  persist();
}
async function runType(group, type) {
  current = {
    groupId: group.id,
    group: group.name,
    typeId: type.id,
    type: type.name,
    status: "running",
    checks: [],
  };
  const old = report.results.findIndex((row) => row.typeId === type.id);
  if (old < 0) report.results.push(current);
  else report.results[old] = current;
  persist();
  await openCreate();
  await page.getByRole("button", { name: "Tạo yêu cầu", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .getElementById("create-handling_group")
        ?.getAttribute("aria-invalid") === "true",
  );
  current.checks.push("empty-submit-blocked");
  await choose("Bộ phận xử lý", group.name, group.occurrence);
  await waitTypeCatalog(group.id);
  const duplicate = group.types
    .filter((row) => row.name === type.name)
    .findIndex((row) => row.id === type.id);
  await choose("Loại yêu cầu", type.name, duplicate);
  assert.equal(Number(await selectedId("Loại yêu cầu")), type.id);
  await choose("Người phê duyệt", "Nhan Nhan");
  const groupError = page.locator("#create-handling_group-error");
  if (await groupError.isVisible()) {
    current.status = "blocked";
    current.reason = await groupError.innerText();
    current.failureScreenshot = await snapshot("type-" + type.id + "-blocked");
    persist();
    return;
  }
  const customers = await selectedId("Công ty");
  if (!customers) await choose("Công ty", "Rainscales VN");
  await page.locator("#create-title").fill("   ");
  await page.waitForFunction(
    () =>
      document.getElementById("create-title")?.getAttribute("aria-invalid") ===
      "true",
  );
  current.title = report.prefix + " [" + type.id + "] " + type.name;
  await page.locator("#create-title").fill(current.title.slice(0, 280));
  current.title = current.title.slice(0, 280);
  await choose("Department", "TEST_20261020_G3CCBK Dept OK");
  await choose("Văn phòng", "TEST_20261020_G3CCBK Office OK");
  await page
    .locator("#create-due-date")
    .fill(format(addDays(startOfToday(), 14), "dd/MM/yyyy"));
  await page.getByRole("heading", { name: /^Chi tiết yêu cầu/ }).waitFor();
  await page
    .getByText("Đang tải biểu mẫu chi tiết...", { exact: true })
    .waitFor({ state: "hidden" });
  await flush();
  // A malformed template is a test result, not an invitation to bypass the UI.
  const template = templates.get(type.id);
  if (!template) {
    const messages = await page.getByRole("alert").allTextContents();
    throw Error("Template unavailable: " + messages.join(" | "));
  }
  current.templateSections = template.forms.length;
  const creation = template.forms.filter((group) => group.editable !== false);
  const fields = creation.flatMap((group) => group.children);
  current.fields = fields.map((field) => ({
    title: clean(field.title),
    type: field.type,
    required: !!field.required,
    options: field.option?.length || 0,
  }));
  current.hasCreationDetails = fields.length > 0;
  const offsets = plannedDates(fields);
  if (fields.length) {
    await page.getByRole("group", { name: "Dòng 1", exact: true }).waitFor();
    current.initialValidationErrors = await page
      .getByRole("alert")
      .allTextContents();
    await fillRow(0, fields, offsets);
    for (let index = 1; index < 5; index++) {
      if (index % 2 === 0)
        await page
          .getByRole("button", { name: "Sao chép dòng " + index, exact: true })
          .click();
      else
        await page
          .getByRole("button", { name: "Thêm dòng", exact: true })
          .click();
      await page
        .getByRole("group", { name: "Dòng " + (index + 1), exact: true })
        .waitFor();
      await fillRow(index, fields, offsets);
    }
    current.rows = await page.locator('fieldset[aria-label^="Dòng "]').count();
    assert.equal(current.rows, 5);
    current.checks.push("five-detail-rows-filled-through-inputs-add-and-copy");
  } else current.rows = 0;
  await page.locator("#create-description").waitFor();
  await page
    .locator("#create-description")
    .fill(
      report.prefix +
        " QC create only; loại " +
        type.id +
        "; " +
        current.rows +
        " dòng chi tiết.",
    );
  const invalid = await page.locator('[aria-invalid="true"]').count();
  assert.equal(invalid, 0, "Errors remain after filling valid data");
  current.checks.push("valid-corrections-cleared-errors");
  current.formScreenshot = await snapshot("type-" + type.id + "-filled");
  const before = createRequests;
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/ticket_manager" &&
      response.request().method() === "POST",
    { timeout: 25000 },
  );
  await page.getByRole("button", { name: "Tạo yêu cầu", exact: true }).click();
  const response = await responsePromise;
  current.createHttpStatus = response.status();
  const saved = await response.json();
  if (!response.ok() || !saved.id)
    throw Error("Create failed: " + JSON.stringify(saved).slice(0, 800));
  current.id = saved.id;
  current.status = "created-awaiting-verification";
  persist();
  const payload = response.request().postDataJSON();
  assert.equal(payload.ticket_type, type.id);
  assert.equal(payload.handling_group, group.id);
  if (fields.length)
    assert.equal(payload.formDataTicket.dataform.data.length, 5);
  await page.waitForURL("**/requests");
  assert.equal(createRequests, before + 1);
  current.checks.push("single-real-create-post");
  await verifyCreated(current);
}
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    timezoneId: "Asia/Ho_Chi_Minh",
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => {
    report.runtimeErrors.push({
      typeId: current?.typeId,
      message: error.message,
    });
    persist();
  });
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST") {
      assert(
        ["/api/token/", "/api/token/refresh/", "/api/ticket_manager"].includes(
          path,
        ),
        "Unexpected mutation in create-only run: " + path,
      );
      if (path === "/api/ticket_manager") createRequests++;
    }
  });
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (response.status() >= 400) {
      report.failedResponses.push({
        typeId: current?.typeId,
        path,
        status: response.status(),
      });
      persist();
    }
    if (!response.ok()) return;
    const url = new URL(response.url());
    if (
      !["/api/list_handling_group/", "/api/list_tickettype/"].includes(path) &&
      !path.startsWith("/api/template_form/")
    )
      return;
    const task = (async () => {
      const data = await response.json();
      if (path === "/api/list_handling_group/") {
        const records = Array.isArray(data) ? data : data.results;
        for (const group of records.filter((group) => group.is_active))
          if (!activeGroups.some((row) => row.id === group.id))
            activeGroups.push({ id: group.id, name: group.name });
      } else if (path === "/api/list_tickettype/") {
        const id = Number(url.searchParams.get("handling_group"));
        const previous = typeCatalogs.get(id) || [];
        typeCatalogs.set(id, [
          ...previous,
          ...data.results.filter(
            (type) => !previous.some((row) => row.id === type.id),
          ),
        ]);
      } else
        templates.set(Number(path.split("/").pop()), {
          forms: data.forms || [],
        });
    })()
      .catch((error) => {
        report.failedResponses.push({ path, message: error.message });
      })
      .finally(() => pending.delete(task));
    pending.add(task);
  });
  await page.goto(base + "/login");
  await page.locator("#login-username").fill(credentials.username);
  await page.locator("#login-password").fill(credentials.password);
  await page
    .getByRole("button", { name: "Sign In to Ticket", exact: true })
    .click();
  await page.waitForURL("**/requests");
  delete report.fatal;
  if (mode === "inventory" || !report.inventory) await inventory();
  if (mode !== "run") return;
  for (const group of report.groups)
    for (const type of group.types) {
      const existing = report.results.find(
        (result) => result.typeId === type.id,
      );
      if (existing?.id) {
        dump("resume-skip-existing-ticket", {
          typeId: type.id,
          id: existing.id,
          status: existing.status,
        });
        continue;
      }
      try {
        await runType(group, type);
      } catch (error) {
        current.status = current.id ? "created-verification-failed" : "failed";
        current.reason = error.message;
        current.alerts = await page
          .getByRole("alert")
          .allTextContents()
          .catch(() => []);
        current.failureScreenshot = await snapshot(
          "type-" + type.id + "-failed",
        ).catch(() => undefined);
        persist();
      }
      dump("type-result", {
        typeId: type.id,
        type: type.name,
        status: current.status,
        id: current.id,
        rows: current.rows,
        reason: current.reason,
      });
    }
  report.summary = {
    total: report.inventory.activeTypes,
    passed: report.results.filter((row) => row.status === "passed").length,
    blocked: report.results.filter((row) => row.status === "blocked").length,
    failed: report.results.filter(
      (row) => !["passed", "blocked"].includes(row.status),
    ).length,
    created: report.results.filter((row) => row.id).length,
  };
  persist();
  dump("complete", report.summary);
})()
  .catch((error) => {
    report.fatal = error.message;
    persist();
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await flush();
    persist();
    if (browser) await browser.close();
  });
