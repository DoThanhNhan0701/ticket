// UI-only real-data QC. Credentials and testPassword arrive through stdin.
// Modes: smoke (first profile), create (all profiles), verify (read-only).
// Resuming reuses exact TEST names and never resubmits an existing account.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const mode = process.argv[2] || "verify";
const base = process.env.BASE_URL || "http://127.0.0.1:5189";
const reportPath =
  process.env.PROFILE_REPORT ||
  "tests/artifacts/ticket-permission-profiles.json";
const report = fs.existsSync(reportPath)
  ? JSON.parse(fs.readFileSync(reportPath, "utf8"))
  : {
      prefix: "TEST_PERM_261021",
      method:
        "Real browser UI only. Create isolated TEST department/team, positions and accounts; log in separately; inspect actual API responses; test each page and sidebar. No direct API calls, mocked permissions or edits to existing users.",
      permissions: [],
      profiles: [],
    };
const configs = {
  departments: {
    path: "/settings/requesting-departments",
    list: "/api/list_bophan_sudung/",
    write: "/api/bophanmmanager/",
    name: "bộ phận sử dụng",
  },
  teams: {
    path: "/settings/teams",
    list: "/api/list_team/",
    write: "/api/teammanager/",
    name: "team",
  },
  positions: {
    path: "/settings/positions",
    list: "/api/list_chucvu/",
    write: "/api/chucvumanager/",
    name: "chức vụ",
  },
  users: {
    path: "/settings/users",
    list: "/api/list_user_v2/",
    write: "/api/usermmanager/",
    name: "người dùng",
  },
};
const pages = [
  ["/requests", "can_view"],
  ["/requests/new", "can_create"],
  ["/requests/all", "can_allticket"],
  ["/requests/change-status", "can_return_ticket"],
  ["/requests/14361", "can_view"],
  ["/tickets/from-email/14361", "can_view"],
  ["/approvals/pending", "can_accept"],
  ["/approvals/approved", "can_accept"],
  ["/tasks/mine", "can_process"],
  ["/tasks", "can_process"],
  ["/reports", "can_report"],
  ["/reports/export", "can_export"],
  ["/recruitment/requests", "can_hr_rec"],
  ["/recruitment/candidates", "can_hr_rec"],
  ["/recruitment/interviews", "can_hr_rec"],
  ["/recruitment/reports", "can_hr_rec"],
  ["/recruitment/interviews/TEST_QC_PERMISSION", "can_cv_interview"],
  ["/settings/users", "can_system"],
  ["/settings/requesting-departments", "can_system"],
  ["/settings/handling-departments", "can_system"],
  ["/settings/request-types", "can_system"],
  ["/settings/teams", "can_system"],
  ["/settings/positions", "can_system"],
  ["/settings/offices", "can_system"],
  ["/settings/users/new", "can_system"],
  ["/settings", "can_system"],
];
const save = () =>
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
const log = (event, data) => console.log(JSON.stringify({ event, ...data }));
let browser;
let current = "setup";
async function login(context, credentials) {
  const page = await context.newPage();
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
  assert(response.ok(), "Account permissions failed");
  const account = await response.json();
  await page.waitForURL((url) => url.pathname !== "/login");
  return { page, account };
}
async function choose(page, label, name) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page
    .getByRole("combobox", { name: "Tìm " + label.toLowerCase(), exact: true })
    .fill(name);
  await page.getByRole("option", { name, exact: true }).click();
}
async function list(page, kind, name) {
  const config = configs[kind];
  const pending = page.waitForResponse(
    (r) => new URL(r.url()).pathname === config.list,
  );
  await page.goto(base + config.path + "?search=" + encodeURIComponent(name));
  const response = await pending;
  assert(response.ok(), "Cannot load " + kind);
  const body = await response.json();
  await page
    .locator(
      `section[aria-label="Danh sách ${config.name}"][aria-busy="false"]`,
    )
    .waitFor();
  const rows = Array.isArray(body) ? body : body.results;
  return rows.find(
    (row) => (kind === "users" ? row.username : row.name) === name,
  );
}
async function create(page, kind, name, fill) {
  const existing = await list(page, kind, name);
  if (existing) return existing;
  assert(mode !== "verify", "Missing TEST record in read-only mode: " + name);
  await page.getByRole("button", { name: "Thêm mới", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const submit = dialog.getByRole("button", { name: "Lưu", exact: true });
  await submit.waitFor();
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-slot="dialog-content"] button[type="submit"]',
      )?.disabled,
  );
  await fill(dialog);
  const pending = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === configs[kind].write,
  );
  await submit.click();
  const response = await pending;
  const result = await response.json();
  assert(
    response.ok(),
    "Create " + kind + " failed: " + JSON.stringify(result),
  );
  if (result.error)
    throw Error("Create " + kind + ": " + JSON.stringify(result.error));
  const savedRecord = result.id ? result : null;
  if (savedRecord) {
    report.creations ??= [];
    report.creations.push({ kind, name, id: savedRecord.id });
    save();
  }
  try {
    await dialog.waitFor({ state: "hidden", timeout: 10000 });
  } catch {
    throw Error(
      "UI did not close after saving " +
        kind +
        ": " +
        (await dialog.getByRole("alert").allTextContents()).join("; "),
    );
  }
  const record = await list(page, kind, name);
  assert(record, "Created record not visible in list: " + name);
  log("created", { kind, name, id: record.id });
  return record;
}
async function createUser(page, profile) {
  const position = await create(
    page,
    "positions",
    profile.positionName,
    async () => {
      await page.locator("#settings-name").fill(profile.positionName);
      await page
        .locator("#settings-description")
        .fill(
          profile.permissions.length > 1
            ? "TEST QC: toàn bộ quyền trong danh mục."
            : "TEST QC: " + (profile.permissions[0] || "không có quyền") + ".",
        );
      if (profile.permissions.length) {
        await page
          .getByRole("button", { name: "Quyền hạn", exact: true })
          .click();
        for (const code of profile.permissions) {
          const permission = report.permissions.find((p) => p.code === code);
          await page
            .getByRole("button", { name: permission.label, exact: true })
            .click();
        }
        await page.keyboard.press("Escape");
      }
    },
  );
  assert.deepEqual(
    [...position.permission].sort((a, b) => a - b),
    profile.permissions
      .map((code) => report.permissions.find((p) => p.code === code).id)
      .sort((a, b) => a - b),
  );
  profile.positionId = position.id;
  save();
  const user = await create(page, "users", profile.username, async () => {
    for (const [key, value] of Object.entries({
      username: profile.username,
      msnv: profile.employeeCode,
      last_name: "TEST QC",
      first_name: profile.label,
      email: profile.username + "@example.invalid",
    })) {
      await page.locator("#settings-" + key).fill(value);
    }
    await choose(page, "Department", report.department.name);
    await choose(page, "Team", report.team.name);
    await choose(page, "Chức vụ", profile.positionName);
  });
  assert.equal(user.chucvu, position.id);
  assert.equal(user.team, report.team.id);
  assert.equal(user.is_active, true);
  assert.equal(user.is_superuser, false);
  assert.equal(user.is_staff, false);
  assert.deepEqual(user.ls_permission, []);
  profile.userId = user.id;
  save();
}
async function verify(profile, password, full) {
  current = profile.username;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  try {
    context.on("request", (request) => {
      if (request.method() !== "GET")
        assert(
          ["/api/token/", "/api/token/refresh/"].includes(
            new URL(request.url()).pathname,
          ),
          "Unexpected write in verification",
        );
    });
    const { page, account } = await login(context, {
      username: profile.username,
      password,
    });
    const actual = [
      ...new Set([
        ...account.userPermission,
        ...Object.values(account.handlingPermission ?? {}).flat(),
      ]),
    ].sort();
    profile.actualPermissions = actual;
    profile.flags = {
      is_superuser: account.is_superuser,
      is_admin: account.is_admin ?? false,
      is_handling: account.is_handling ?? false,
    };
    profile.login = "passed";
    save();
    assert.deepEqual(
      actual,
      [...profile.permissions].sort(),
      "Unexpected inherited functional permissions",
    );
    assert.equal(profile.flags.is_superuser, false);
    assert.equal(profile.flags.is_admin, false);
    assert.equal(profile.flags.is_handling, false);
    if (!full) return;
    profile.pages = [];
    const roles = new Set(actual);
    await page.getByRole("main").waitFor();
    await page.waitForLoadState("networkidle");
    const contextual = new Set([
      "/requests/new",
      "/requests/14361",
      "/tickets/from-email/14361",
      "/recruitment/interviews/TEST_QC_PERMISSION",
      "/settings/users/new",
      "/settings",
    ]);
    const expectedLinks = pages
      .filter(
        ([path, permission]) => !contextual.has(path) && roles.has(permission),
      )
      .map(([path]) => path)
      .sort();
    const actualLinks = await page
      .getByRole("complementary", { name: "Sidebar Ticket" })
      .locator("a[href]")
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute("href")).sort(),
      );
    assert.deepEqual(
      actualLinks,
      expectedLinks,
      "Sidebar does not match assigned permissions",
    );
    profile.sidebar = { result: "passed", links: actualLinks };
    for (const [path, permission] of pages) {
      const requests = [];
      const apiErrors = [];
      const observeResponse = (response) => {
        const pathname = new URL(response.url()).pathname;
        if (pathname.startsWith("/api/") && response.status() >= 400)
          apiErrors.push({ path: pathname, status: response.status() });
      };
      const observe = (request) => {
        const path = new URL(request.url()).pathname;
        if (path.startsWith("/api/")) requests.push(path);
      };
      page.on("request", observe);
      page.on("response", observeResponse);
      const restored = page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/api/list_permission/",
      );
      await page.goto(base + path);
      await restored;
      const expected = roles.has(permission);
      if (!expected) {
        await page
          .getByRole("heading", {
            name: "Bạn chưa có quyền truy cập",
            exact: true,
          })
          .waitFor();
        assert(
          requests.every((path) =>
            ["/api/list_permission/", "/api/token/refresh/"].includes(path),
          ),
          "Blocked page fetched data: " + path,
        );
      } else {
        await page.getByRole("main").waitFor();
        assert.equal(
          await page
            .getByRole("heading", {
              name: "Bạn chưa có quyền truy cập",
              exact: true,
            })
            .count(),
          0,
        );
      }
      await page.waitForLoadState("networkidle");
      page.off("request", observe);
      page.off("response", observeResponse);
      profile.pages.push({
        path,
        permission,
        expected: expected ? "allowed" : "denied",
        result: "passed",
        apiErrors,
        displayedAlerts: await page
          .getByRole("main")
          .getByRole("alert")
          .allTextContents(),
      });
      save();
    }
    profile.verification = "passed";
    save();
    log("verified", {
      username: profile.username,
      permissions: actual,
      allowed: profile.pages.filter((p) => p.expected === "allowed").length,
      denied: profile.pages.filter((p) => p.expected === "denied").length,
    });
  } finally {
    await context.close();
  }
}
(async () => {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  assert(
    input.admin?.username && input.admin?.password && input.testPassword,
    "Credentials must arrive on stdin",
  );
  assert(["smoke", "create", "verify"].includes(mode));
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  try {
    const admin = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const { page } = await login(admin, input.admin);
    const allow = new Set([
      "/api/token/",
      "/api/token/refresh/",
      ...Object.values(configs).map((c) => c.write),
    ]);
    page.on("request", (request) => {
      if (request.method() !== "GET")
        assert(
          mode !== "verify" && allow.has(new URL(request.url()).pathname),
          "Unauthorized mutation",
        );
    });
    const pending = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/list_position_permission/",
    );
    await page.goto(base + configs.positions.path);
    const permissions = await (await pending).json();
    await page
      .getByRole("button", { name: "Thông tin quyền hạn", exact: true })
      .click();
    const info = page.getByRole("dialog", {
      name: "Thông tin quyền hạn",
      exact: true,
    });
    const entries = await info.locator("dt").evaluateAll((nodes) =>
      nodes.map((node) => ({
        label: node.querySelector("span")?.textContent ?? node.textContent,
        retired: node.textContent.includes("Ngừng cấp mới"),
      })),
    );
    assert.equal(entries.length, permissions.length);
    report.permissions = permissions.map((p, i) => ({
      id: p.id,
      code: p.name,
      label: entries[i].label,
      retired: entries[i].retired,
      active: p.is_active,
    }));
    await info
      .getByRole("button", { name: "Đóng thông tin quyền hạn", exact: true })
      .click();
    if (!report.profiles.length) {
      const assignable = report.permissions.filter(
        (permission) => permission.active && !permission.retired,
      );
      report.profiles = [
        ...assignable.map((p) => ({
          key: p.code.replace(/^can_/, ""),
          label: p.label,
          permissions: [p.code],
        })),
        { key: "none", label: "Không quyền", permissions: [] },
        {
          key: "all",
          label: "Đủ quyền",
          permissions: assignable.map((p) => p.code),
        },
      ].map((p, i) => ({
        ...p,
        username: "test_p261021_" + p.key,
        positionName: report.prefix + "_" + p.key,
        employeeCode: "TP261021" + String(i + 1).padStart(2, "0"),
      }));
      save();
    }
    if (mode !== "verify") {
      const name = "TEST_QC_PERM_261021";
      const department = await create(page, "departments", name, () =>
        page.locator("#settings-name").fill(name),
      );
      report.department = { id: department.id, name: department.name };
      save();
      const team = await create(page, "teams", name, async () => {
        await page.locator("#settings-name").fill(name);
        await choose(page, "Department", name);
      });
      assert.equal(team.is_handling, false);
      report.team = { id: team.id, name: team.name };
      save();
    }
    const profiles =
      mode === "smoke" ? report.profiles.slice(0, 1) : report.profiles;
    for (const profile of profiles) {
      current = profile.username;
      if (mode === "create" && profile.verification === "passed") {
        log("reuse-verified", { username: profile.username });
        continue;
      }
      if (mode !== "verify") await createUser(page, profile);
      await verify(profile, input.testPassword, mode !== "smoke");
    }
    await admin.close();
    delete report.failure;
    save();
    log("complete", { mode, profiles: profiles.length, report: reportPath });
  } finally {
    await browser.close();
  }
})().catch((error) => {
  report.failure = { profile: current, message: error.message };
  save();
  console.error(error.message);
  process.exitCode = 1;
});
