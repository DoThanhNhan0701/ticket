// Credentials arrive on stdin; only the isolated TEST group is edited.
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const fixture = JSON.parse(
      fs.readFileSync(
        process.env.HANDLING_REPORT || "/tmp/handling-live-state.json",
        "utf8",
      ),
    ),
    creds = JSON.parse(fs.readFileSync(0, "utf8")),
    tokens = {};
  const root = process.env.API_URL || "https://ticket-api.aiminds.io.vn/api",
    base = process.env.BASE_URL || "http://127.0.0.1:5198";
  const report = {
    startedAt: new Date().toISOString(),
    checks: [],
    writes: [],
    runtimeErrors: [],
  };
  const save = () =>
    fs.writeFileSync(
      process.env.HANDLING_UI_REPORT || "/tmp/handling-ui-result.json",
      JSON.stringify(report, null, 2) + "\n",
    );
  const record = (name, detail = {}) => {
    report.checks.push({ name, status: "passed", ...detail });
    save();
    console.log(name);
  };
  for (const [user, password] of Object.entries(creds)) {
    const response = await fetch(root + "/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password }),
    });
    assert(response.ok);
    tokens[user] = await response.json();
  }
  const api = async (path, body) => {
    if (body)
      assert(
        path === "/handlinggroupmmanager/" + fixture.groupId &&
          body.name === fixture.groupName,
        "TEST group only",
      );
    const response = await fetch(root + path, {
      method: body ? "PUT" : "GET",
      headers: {
        Authorization: "Bearer " + tokens.admin.access,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert(response.ok);
    return response.json();
  };
  const shape = (g) => ({
    name: g.name,
    description: g.description,
    is_active: g.is_active,
    is_manager: g.is_manager,
    group_email: g.group_email,
    ls_member: g.ls_member,
  });
  const original = shape(
    await api("/handlinggroupmmanager/" + fixture.groupId),
  );
  const browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
        : {}),
      args: ["--no-sandbox"],
    }),
    pages = {};
  let permissionReads = 0;
  const pageFor = async (user) => {
    if (pages[user]) return pages[user];
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await ctx.addCookies([
      { name: "_access_token_ticket", value: tokens[user].access, url: base },
      { name: "_refresh_token_ticket", value: tokens[user].refresh, url: base },
    ]);
    await ctx.route("**/api/**", (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (req.method() === "GET") return route.continue();
      let body;
      try {
        body = req.postDataJSON();
      } catch {
        body = null;
      }
      if (
        req.method() === "PUT" &&
        path === "/api/handlinggroupmmanager/" + fixture.groupId &&
        body?.name === fixture.groupName &&
        [817, 818, fixture.c.id].includes(body.is_manager) &&
        body.ls_member.every((id) => [817, 818, fixture.c.id].includes(id))
      ) {
        report.writes.push({ path, body });
        save();
        return route.continue();
      }
      return route.abort();
    });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => {
      report.runtimeErrors.push(e.message);
      save();
    });
    if (user === "admin")
      p.on("response", (res) => {
        if (new URL(res.url()).pathname === "/api/list_permission/" && res.ok())
          permissionReads++;
      });
    pages[user] = p;
    return p;
  };
  const ticket = async (user, assign) => {
    const p = await pageFor(user);
    await p.goto(base + "/requests/" + fixture.normalTicket);
    await p
      .getByRole("tab", { name: "Thông tin chung", exact: true })
      .waitFor();
    assert.equal(
      await p.getByRole("button", { name: "Phân công", exact: true }).count(),
      assign ? 1 : 0,
    );
    return p;
  };
  try {
    await ticket("test_act22_a_iwa0tx", true);
    await ticket("test_act22_b_iwa0tx", false);
    record("ui-original-head-only-sees-assign");
    const p = await pageFor("admin");
    await p.goto(
      base +
        "/settings/handling-departments?search=" +
        encodeURIComponent(fixture.groupName),
    );
    await p
      .getByRole("button", {
        name: "Chỉnh sửa " + fixture.groupName,
        exact: true,
      })
      .click();
    const d = p.getByRole("dialog").last();
    await d
      .getByRole("combobox", { name: "Người quản lý", exact: true })
      .click();
    await p
      .getByRole("option")
      .filter({ hasText: "test_act22_b_iwa0tx" })
      .click();
    await d.getByRole("button", { name: "Thành viên", exact: true }).click();
    await p
      .getByRole("searchbox", { name: "Search thành viên", exact: true })
      .fill(fixture.c.username);
    await p
      .getByRole("button", {
        name: new RegExp(fixture.c.username),
        pressed: false,
      })
      .click();
    await p.keyboard.press("Escape");
    const before = permissionReads;
    await d.getByRole("button", { name: "Lưu", exact: true }).click();
    await d.waitFor({ state: "hidden" });
    assert(
      permissionReads > before,
      "Current account permission must refresh after department save",
    );
    let group = await api("/handlinggroupmmanager/" + fixture.groupId);
    assert.equal(group.is_manager, 818);
    assert.deepEqual(
      [...group.ls_member].sort(),
      [817, 818, fixture.c.id].sort(),
    );
    record("ui-updates-head-and-three-members-and-refreshes-profile", {
      permissionReadsBefore: before,
      permissionReadsAfter: permissionReads,
    });
    await ticket("test_act22_a_iwa0tx", false);
    const bp = await ticket("test_act22_b_iwa0tx", true);
    record("ui-old-head-loses-assign-new-head-gains-assign");
    await bp.getByRole("button", { name: "Phân công", exact: true }).click();
    const bd = bp.getByRole("dialog").last();
    await bd
      .getByRole("button", { name: "Người nhận xử lý", exact: true })
      .click();
    assert.equal(
      await bp
        .getByRole("button", {
          name: fixture.c.username,
          exact: true,
          pressed: false,
        })
        .count(),
      1,
    );
    await bp.keyboard.press("Escape");
    await bd.getByRole("button", { name: "Thoát", exact: true }).click();
    record("ui-new-member-c-appears-as-assignment-candidate");
    const ga = shape(await api("/handlinggroupmmanager/2"));
    assert.deepEqual(ga, fixture.gaOriginal);
    record("ui-run-confirms-ga-original-configuration-restored", {
      manager: ga.is_manager,
      members: ga.ls_member,
    });
  } finally {
    await api("/handlinggroupmmanager/" + fixture.groupId, original);
    assert.deepEqual(
      shape(await api("/handlinggroupmmanager/" + fixture.groupId)),
      original,
    );
    record("normal-group-original-fixture-restored");
    await browser.close();
  }
  assert.equal(report.runtimeErrors.length, 0);
  report.status = "passed";
  report.completedAt = new Date().toISOString();
  save();
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
