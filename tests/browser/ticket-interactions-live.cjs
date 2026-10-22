const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
// Live writes are limited to this run's TEST fixtures. Credentials are read from stdin.
// Keep the resumable state outside Vite's watched tree; never commit credentials.
// Required credential keys: admin, _testPassword, test_p261021_all,
// test_p261021_accept, test_form20_reader_ivdviv, test_p261021_view.
// _adminFallback is optional. Existing isolated fixture IDs reflect this QA environment.
const work =
    process.env.INTERACTIONS_REPORT ||
    "/tmp/ticket-interactions-live-state.json",
  base = process.env.BASE_URL || "http://127.0.0.1:5198",
  root = process.env.API_URL || "https://ticket-api.aiminds.io.vn/api";
const r = fs.existsSync(work)
  ? JSON.parse(fs.readFileSync(work, "utf8"))
  : {
      prefix: "TEST_ACT22_" + Date.now().toString(36).slice(-6).toUpperCase(),
      startedAt: new Date().toISOString(),
      accounts: {},
      tickets: [],
      checks: [],
      writes: [],
      faults: [],
      errors: [],
      attemptFailures: [],
      status: "running",
    };
const save = () => fs.writeFileSync(work, JSON.stringify(r, null, 2) + "\n");
for (const check of r.checks) {
  if (typeof check.status === "number") {
    check.ticketStatus = check.status;
    check.status = "passed";
  }
}
const record = (name, detail = {}) => {
  const { status: ticketStatus, ...rest } = detail;
  const c = {
      name,
      status: "passed",
      ...rest,
      ...(ticketStatus !== undefined ? { ticketStatus } : {}),
    },
    i = r.checks.findIndex((c) => c.name === name);
  if (i < 0) r.checks.push(c);
  else r.checks[i] = c;
  save();
  console.log(JSON.stringify({ name, status: "passed" }));
};
const has = (name) =>
  r.checks.some((c) => c.name === name && c.status === "passed");
const own = (id) => r.tickets.some((t) => t.id === Number(id));
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8")),
    auth = {};
  const login = async (user, password) => {
    let response = await fetch(root + "/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password }),
    });
    if (!response.ok && user === "admin" && credentials._adminFallback) {
      r.authDiagnostic = {
        latestAdminCredentialStatus: response.status,
        usedPreviouslyProvidedCredential: true,
      };
      response = await fetch(root + "/token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user,
          password: credentials._adminFallback,
        }),
      });
    }
    assert(response.ok, "Login " + user + " " + response.status);
    auth[user] = await response.json();
  };
  for (const [user, password] of Object.entries(credentials).filter(
    ([key]) => !key.startsWith("_"),
  ))
    await login(user, password);
  const admin = "admin",
    creator = "test_p261021_all",
    accept = "test_p261021_accept",
    reader = "test_form20_reader_ivdviv",
    noPermission = "test_p261021_view";
  const api = async (user, path, body, method = "POST") => {
    if (body !== undefined) {
      let allowed = false;
      if (path === "/usermmanager/")
        allowed =
          body instanceof FormData &&
          String(body.get("username")).startsWith("test_act22_") &&
          body.get("chucvu") === "39";
      if (path === "/handlinggroupmmanager/")
        allowed =
          body.name === r.prefix &&
          body.is_manager === 334 &&
          body.ls_member.every((id) =>
            [334, ...Object.values(r.accounts).map((a) => a.id)].includes(id),
          );
      if (path === "/tickettypemmanager/")
        allowed =
          body instanceof FormData &&
          body.get("name") === r.prefix &&
          Number(body.get("handling_group")) === r.groupId;
      if (path === "/template_form/") allowed = body.ticket_type === r.typeId;
      if (
        ["/accept_ticket/", "/receive_ticket/", "/update_duedate/"].includes(
          path,
        )
      )
        allowed = own(body.ticket_id);
      assert(allowed, "Write outside TEST scope " + path);
    }
    const response = await fetch(root + path, {
      method: body === undefined ? "GET" : method,
      headers: {
        Authorization: "Bearer " + auth[user].access,
        ...(body !== undefined && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(body === undefined
        ? {}
        : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
    const data = await response.json();
    if (body !== undefined) {
      r.writes.push({
        transport: "setup-api",
        user,
        path,
        method,
        status: response.status,
      });
      save();
    }
    if (!response.ok)
      throw Error(path + " " + response.status + " " + JSON.stringify(data));
    return data;
  };
  for (const key of ["a", "b"]) {
    if (!r.accounts[key]) {
      const username =
          "test_act22_" + key + "_" + r.prefix.split("_").at(-1).toLowerCase(),
        body = new FormData();
      for (const [k, v] of Object.entries({
        username,
        msnv: "TA22" + key.toUpperCase() + r.prefix.split("_").at(-1),
        first_name: "Handler " + key.toUpperCase(),
        last_name: "TEST ACT22",
        email: username + "@example.invalid",
        team: "90",
        bophan: "32",
        chucvu: "39",
        nhomquyen: "",
        is_active: "true",
      }))
        body.set(k, v);
      const created = await api(admin, "/usermmanager/", body);
      assert(created.id);
      r.accounts[key] = { id: created.id, username };
      save();
    }
    await login(r.accounts[key].username, credentials._testPassword);
  }
  if (!r.groupId) {
    const group = await api(admin, "/handlinggroupmmanager/", {
      name: r.prefix,
      description:
        "Isolated TEST interaction workflows; retained for user review",
      is_active: true,
      is_manager: 334,
      group_email: r.prefix.toLowerCase() + "@example.invalid",
      ls_member: [334, r.accounts.a.id, r.accounts.b.id],
    });
    assert(group.id);
    r.groupId = group.id;
    save();
  }
  if (!r.typeId) {
    const body = new FormData();
    body.set("name", r.prefix);
    body.set("handling_group", String(r.groupId));
    body.set("is_active", "true");
    const type = await api(admin, "/tickettypemmanager/", body);
    assert(type.id);
    r.typeId = type.id;
    save();
  }
  if (!r.templateSaved) {
    const source = await api(admin, "/template_form/192");
    await api(admin, "/template_form/", {
      ticket_type: r.typeId,
      user: 334,
      data_form: { forms: source.forms },
      mota: r.prefix,
      ghichu: "Live interaction tests; only isolated TEST tickets",
    });
    r.templateSaved = true;
    save();
  }
  for (const user of [
    creator,
    accept,
    reader,
    ...Object.values(r.accounts).map((x) => x.username),
  ]) {
    const p = await api(user, "/list_permission/");
    r.roles = r.roles ?? {};
    r.roles[user] = {
      id: p.infoUser[0],
      is_handling: p.is_handling,
      permissions: p.userPermission,
    };
  }
  save();
  record("isolated-TEST-config-and-real-roles", {
    group: r.groupId,
    type: r.typeId,
    handlers: r.accounts,
  });
  if (process.argv[2] === "setup") return;
  const browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
        : {}),
      args: ["--no-sandbox"],
    }),
    pages = {};
  let fault;
  const count = (path, id) =>
    r.writes.filter(
      (w) =>
        w.transport === "browser" &&
        w.path === path &&
        (!id || w.ticketId === id) &&
        w.forwarded !== false,
    ).length;
  const pageFor = async (user) => {
    if (pages[user]) return pages[user];
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "Asia/Ho_Chi_Minh",
    });
    await context.addCookies([
      { name: "_access_token_ticket", value: auth[user].access, url: base },
      { name: "_refresh_token_ticket", value: auth[user].refresh, url: base },
    ]);
    await context.route("**/api/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname,
        method = req.method();
      if (method === "GET" || path === "/api/token/refresh/")
        return route.continue();
      const raw = req.postData() ?? "";
      let body;
      try {
        body = req.postDataJSON();
      } catch {
        body = null;
      }
      const ticketId = Number(
        body?.ticket_id ?? raw.match(/name="ticket_id"\r\n\r\n(\d+)/)?.[1],
      );
      const commentId = Number(
        raw.match(/name="comment_id"\r\n\r\n(\d+)/)?.[1],
      );
      let allowed =
        own(ticketId) ||
        Boolean(commentId && r.commentIds?.includes(commentId));
      if (path === "/api/ticket_manager")
        allowed =
          body?.title.startsWith(r.prefix) &&
          body?.handling_group === r.groupId &&
          body?.ticket_type === r.typeId &&
          r.tickets.length < 7;
      if (!allowed) {
        r.blocked = r.blocked ?? [];
        r.blocked.push({ path, method, ticketId, commentId });
        save();
        return route.abort();
      }
      if (
        fault &&
        fault.path === path &&
        (!fault.ticketId || fault.ticketId === ticketId)
      ) {
        const current = fault;
        fault = null;
        r.faults.push({ ...current, forwarded: false });
        r.writes.push({
          transport: "browser",
          user,
          path,
          method,
          ticketId,
          status: 503,
          forwarded: false,
        });
        save();
        return route.fulfill({ status: 503, json: { detail: current.name } });
      }
      if (path === "/api/ticket_manager") {
        const response = await route.fetch({ maxRetries: 0 });
        const data = await response.json();
        if (response.ok() && data.id) {
          r.tickets.push({
            id: data.id,
            code: data.ticket_code,
            title: body.title,
            scenario: body.title.split(" · ").at(-1),
            creator: user,
          });
          save();
        }
        r.writes.push({
          transport: "browser",
          user,
          path,
          method,
          ticketId: data.id,
          status: response.status(),
          forwarded: true,
        });
        save();
        return route.fulfill({ response });
      }
      return route.continue();
    });
    const p = await context.newPage();
    p.setDefaultTimeout(30000);
    p.on("pageerror", (e) => {
      r.errors.push(e.message);
      save();
    });
    p.on("response", (response) => {
      const req = response.request(),
        path = new URL(req.url()).pathname;
      if (
        req.method() === "GET" ||
        !path.startsWith("/api/") ||
        ["/api/ticket_manager", "/api/token/refresh/"].includes(path)
      )
        return;
      const raw = req.postData() ?? "";
      let body;
      try {
        body = req.postDataJSON();
      } catch {
        body = null;
      }
      if (
        response.status() === 503 &&
        r.writes.some(
          (w) => w.path === path && w.status === 503 && w.forwarded === false,
        )
      )
        return;
      const ticketId = Number(
        body?.ticket_id ?? raw.match(/name="ticket_id"\r\n\r\n(\d+)/)?.[1],
      );
      r.writes.push({
        transport: "browser",
        user,
        path,
        method: req.method(),
        ticketId: ticketId || null,
        status: response.status(),
        forwarded: true,
      });
      save();
    });
    pages[user] = p;
    await p.goto(base + "/requests");
    await p.locator("main").waitFor();
    return p;
  };
  const get = async (id, user = admin) => {
    assert(own(id));
    return api(user, "/ticket_manager/" + id);
  };
  const state = async (id) => {
    const t = await get(id),
      history = await api(admin, "/list_ticket_history/?ticket_id=" + id);
    return {
      id,
      status: t.ticket_status,
      statusName: t.ticket_status_name,
      handlers: t.list_user_received,
      buttons: Object.keys(t.list_button ?? {}),
      historyEntries: history.length ?? 0,
    };
  };
  const goto = async (user, id, tab = "general") => {
    const p = await pageFor(user);
    await p.goto(base + "/requests/" + id + "?tab=" + tab);
    await p
      .getByRole("tab", { name: "Thông tin chung", exact: true })
      .waitFor();
    return p;
  };
  const create = async (scenario) => {
    const old = r.tickets.find((t) => t.scenario === scenario);
    if (old) return old.id;
    const p = await pageFor(creator);
    await p.goto(base + "/requests/new");
    await p.locator("#create-handling_group").waitFor();
    await p.evaluate(
      async ({ prefix, groupId, typeId, scenario }) => {
        const a =
            await import("/src/features/requests/api/create-request-api.ts"),
          { getRequestTemplate } =
            await import("/src/features/settings/api/template-api.ts"),
          u =
            await import("/src/features/requests/utils/request-detail-data.ts");
        const forms = (await getRequestTemplate(typeId)).forms,
          row = u.emptyDetailRow(u.getCreateRequestGroups(forms));
        Object.assign(row.values, {
          f0: prefix + " public " + scenario,
          f1: prefix + " private " + scenario,
          f2: "",
          f3: "0",
          f4: "日本語",
          f5: "20/11/2026",
          f6: "21/11/2026",
          f7: "20/11/2026",
          f8: "19/11/2026",
          f9: "20/11/2026",
          f10_start: "20/11/2026",
          f10_end: "22/11/2026",
          f11: "Sáng",
          f12: "",
        });
        await a.createRequest(
          {
            handling_group: String(groupId),
            ticket_type: String(typeId),
            approve_user: scenario === "APPROVAL_UI" ? "816" : "804",
            fore_cus: "2",
            bophansudung: "31",
            other1: ["89"],
            vanphong: "8",
            title: prefix + " · " + scenario,
            description:
              "TEST: isolated live ticket interactions; retained for review",
            duedate: "25/11/2026",
            rows: [row],
          },
          forms,
        );
      },
      { ...r, scenario },
    );
    const saved = r.tickets.find((t) => t.scenario === scenario);
    assert(saved, "Create receipt missing");
    const data = await get(saved.id);
    assert.equal(data.ticket_status, 1);
    record("create-" + scenario, { id: saved.id, code: saved.code, status: 1 });
    return saved.id;
  };
  const act = async (tag, user, id, action, fill, expected) => {
    if (has(tag)) return state(id);
    const p = await goto(user, id);
    const trigger = p.getByRole("button", { name: action, exact: true });
    await trigger.click();
    const d = p.getByRole("dialog").last();
    await d.waitFor();
    if (fill) await fill(d, p);
    await d.getByRole("button", { name: action, exact: true }).click();
    await d.waitFor({ state: "hidden" });
    const result = await state(id);
    if (expected !== undefined) assert.equal(result.status, expected, tag);
    record(tag, { actor: user, ...result });
    return result;
  };
  const select = async (d, label, value) => {
    await d.getByRole("combobox", { name: label, exact: true }).click();
    await d.page().getByRole("option", { name: value, exact: true }).click();
  };
  const multi = async (d, label, labels) => {
    await d.getByRole("button", { name: label, exact: true }).click();
    for (const value of labels)
      await d
        .page()
        .getByRole("button", { name: value, exact: true, pressed: false })
        .click();
    await d.page().keyboard.press("Escape");
  };
  const candidate = async (id, key) => {
    const t = await get(id),
      account =
        key === "admin" ? { id: 334, username: admin } : r.accounts[key];
    const found = Object.entries(t.list_user_not_received).find(
      ([, value]) => Number(value) === account.id,
    );
    assert(found, "Missing candidate " + key + " on " + id);
    return found[0];
  };
  try {
    const life = await create("LIFECYCLE"),
      cancel = await create("CANCEL_RETRY"),
      manager = await create("MANAGER_BRANCH"),
      denied = await create("DENIED_ACTION"),
      review = await create("REVIEW_OPEN");
    const approvalUI = await create("APPROVAL_UI");
    r.reviewTicket = review;
    save();
    if (process.argv[2] === "prepare") return;

    const a = r.accounts.a.username,
      b = r.accounts.b.username;
    assert.equal(r.roles[a].is_handling, true);
    assert.equal(r.roles[b].is_handling, true);
    assert.equal(r.roles[creator].is_handling, false);
    const file = (suffix, text) => ({
      name: r.prefix + "_" + suffix,
      mimeType: "text/plain",
      buffer: Buffer.from(text),
    });
    if (
      !r.securityFindings?.some(
        (f) => f.name === "backend-approval-permission-bypass",
      )
    ) {
      const permissions = await api(noPermission, "/list_permission/"),
        before = await get(denied);
      let responseStatus, body;
      if (before.ticket_status === 1) {
        const response = await fetch(root + "/accept_ticket/", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + auth[noPermission].access,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ticket_id: denied }),
        });
        responseStatus = response.status;
        body = await response.json();
      }
      const after = await get(denied),
        history = await api(admin, "/list_ticket_history/?ticket_id=" + denied);
      if (after.ticket_status !== 1) {
        r.securityFindings = r.securityFindings ?? [];
        r.securityFindings.push({
          name: "backend-approval-permission-bypass",
          severity: "critical",
          status: "open - backend enforcement required",
          ticketId: denied,
          actor: noPermission,
          actualPermissions: permissions.userPermission,
          is_handling: permissions.is_handling,
          endpoint: "/accept_ticket/",
          method: "POST",
          request: { ticket_id: denied },
          expected:
            "Reject actor without approval permission and leave ticket in status 1",
          actualStatus: after.ticket_status,
          history,
          responseStatus,
          body,
        });
        const name = "API rejects approval from view-only account";
        r.checks.push({
          name,
          status: "failed",
          ticketId: denied,
          reason:
            "API changed ticket from status 1 to 2 for can_view-only account",
        });
        save();
        console.log(
          JSON.stringify({ name, status: "failed", ticketId: denied }),
        );
      } else
        record("denied-action-never-changes-real-ticket", {
          id: denied,
          actor: noPermission,
          httpStatus: responseStatus,
          response: body,
        });
    }
    if (!has("reader-has-no-approval-or-assignment-controls")) {
      const p = await goto(reader, life);
      assert.equal(
        await p.getByRole("button", { name: "Phê duyệt", exact: true }).count(),
        0,
      );
      assert.equal(
        await p.getByRole("button", { name: "Phân công", exact: true }).count(),
        0,
      );
      record("reader-has-no-approval-or-assignment-controls", { id: life });
    }
    if (!has("due-date-rejects-same-or-earlier-without-write")) {
      const p = await goto(creator, life);
      await p
        .getByRole("button", { name: "Đổi ngày mong muốn", exact: true })
        .click();
      await p.locator("#ticket-due-date").fill("25/11/2026");
      const before = count("/api/update_duedate/", life);
      await p
        .getByRole("button", { name: "Lưu ngày mong muốn", exact: true })
        .click();
      await p
        .getByText("Ngày mong muốn mới phải sau ngày mong muốn hiện tại.", {
          exact: true,
        })
        .waitFor();
      assert.equal(count("/api/update_duedate/", life), before);
      await p
        .getByRole("button", { name: "Hủy đổi ngày", exact: true })
        .click();
      record("due-date-rejects-same-or-earlier-without-write", { id: life });
    }
    if (!has("due-date-update-persists")) {
      const p = await goto(creator, life);
      await p
        .getByRole("button", { name: "Đổi ngày mong muốn", exact: true })
        .click();
      await p.locator("#ticket-due-date").fill("26/11/2026");
      await p
        .getByRole("button", { name: "Lưu ngày mong muốn", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Đổi ngày mong muốn", exact: true })
        .waitFor();
      assert.equal((await get(life)).duedate, "2026-11-26");
      record("due-date-update-persists", { id: life, date: "2026-11-26" });
    }
    if (!has("real-files-upload-download-and-image-preview")) {
      const p = await goto(creator, life);
      const png = await p.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        const context = canvas.getContext("2d");
        context.fillStyle = "#7367c8";
        context.fillRect(0, 0, 16, 16);
        return canvas.toDataURL("image/png").split(",")[1];
      });
      const files = [
        {
          name: r.prefix + "_main.txt",
          type: "text/plain",
          bytes: [...Buffer.from("Real TEST ticket attachment " + r.prefix)],
        },
        {
          name: r.prefix + "_main.png",
          type: "image/png",
          bytes: [...Buffer.from(png, "base64")],
        },
      ];
      const existing = await get(life);
      for (const f of files)
        if (!Object.hasOwn(existing.attachment_files, f.name))
          await p.evaluate(
            async ({ id, f }) => {
              const { uploadRequestAttachment } =
                await import("/src/features/requests/api/create-request-api.ts");
              await uploadRequestAttachment(
                id,
                new File([new Uint8Array(f.bytes)], f.name, { type: f.type }),
              );
            },
            { id: life, f },
          );
      const saved = await get(life);
      for (const f of files) {
        assert(saved.attachment_files[f.name]);
        const url = await p.evaluate(async (path) => {
          const { ticketFileUrl } =
            await import("/src/features/requests/utils/ticket-detail.ts");
          return ticketFileUrl(path);
        }, saved.attachment_files[f.name]);
        const response = await p.request.get(url);
        assert(response.ok());
        const bytes = await response.body();
        assert.equal(
          crypto.createHash("sha256").update(bytes).digest("hex"),
          crypto
            .createHash("sha256")
            .update(Buffer.from(f.bytes))
            .digest("hex"),
        );
      }
      await goto(creator, life);
      await p
        .getByRole("button", { name: r.prefix + "_main.png", exact: true })
        .click();
      await p.waitForFunction(() =>
        [...document.querySelectorAll("[role=dialog] img")].some(
          (img) => img.complete && img.naturalWidth === 16,
        ),
      );
      await p
        .getByRole("button", { name: "Đóng xem trước ảnh", exact: true })
        .click();
      record("real-files-upload-download-and-image-preview", {
        id: life,
        files: files.map((f) => f.name),
        sha256Matched: true,
      });
    }
    if (!has("empty-comment-does-not-call-api")) {
      const p = await goto(creator, life, "discussion"),
        composer = p.getByRole("form", { name: "Phản hồi mới", exact: true }),
        before = count("/api/ticket_comment", life);
      await composer
        .getByRole("button", { name: "Gửi phản hồi", exact: true })
        .click();
      assert.equal(count("/api/ticket_comment", life), before);
      assert.equal((await get(life)).comments.length, 0);
      record("empty-comment-does-not-call-api", { id: life });
    }
    if (!has("comment-network-failure-preserves-draft-and-retry-saves-once")) {
      const p = await goto(creator, life, "discussion"),
        composer = p.getByRole("form", { name: "Phản hồi mới", exact: true }),
        content = r.prefix + " comment original",
        existing = (await get(life)).comments.find(
          (c) => c.content === content,
        );
      if (!existing) {
        await composer.getByLabel("Phản hồi", { exact: true }).fill(content);
        await composer
          .locator("input[type=file]")
          .setInputFiles(file("comment.txt", "Real comment file " + r.prefix));
        fault = {
          path: "/api/ticket_comment",
          ticketId: life,
          name: "TEST controlled comment offline",
        };
        await composer
          .getByRole("button", { name: "Gửi phản hồi", exact: true })
          .click();
        await composer.getByRole("alert").waitFor();
        assert.equal(
          await composer.getByLabel("Phản hồi", { exact: true }).inputValue(),
          content,
        );
        assert.equal(
          await composer
            .getByText(r.prefix + "_comment.txt", { exact: true })
            .count(),
          1,
        );
        await composer
          .getByRole("button", { name: "Gửi phản hồi", exact: true })
          .click();
        await composer.getByLabel("Phản hồi", { exact: true }).waitFor();
        await p.getByText(content, { exact: true }).waitFor();
      }
      const saved = await get(life),
        comments = saved.comments.filter((c) => c.content === content);
      assert.equal(comments.length, 1);
      assert.equal(Object.keys(comments[0].att_file).length, 1);
      r.commentIds = [comments[0].id];
      r.parentCommentId = comments[0].id;
      save();
      record("comment-network-failure-preserves-draft-and-retry-saves-once", {
        id: life,
        commentId: r.parentCommentId,
      });
    }
    if (!has("reply-with-real-attachment-persists")) {
      const p = await goto(admin, life, "discussion"),
        content = r.prefix + " reply original",
        existing = (await get(life)).comments
          .find((c) => c.id === r.parentCommentId)
          ?.item_comment.find((c) => c.content === content);
      if (!existing) {
        const article = p.getByRole("article", {
          name: "Phản hồi của " + creator,
          exact: true,
        });
        await article.hover();
        await article
          .getByRole("button", { name: "Trả lời", exact: true })
          .click();
        const form = p.getByRole("form", {
          name: "Trả lời " + creator + " mới",
          exact: true,
        });
        await form
          .getByLabel("Trả lời " + creator, { exact: true })
          .fill(content);
        await form
          .locator("input[type=file]")
          .setInputFiles(file("reply.txt", "Real reply file " + r.prefix));
        await form
          .getByRole("button", { name: "Gửi phản hồi", exact: true })
          .click();
        await form.waitFor({ state: "hidden" });
      }
      const parent = (await get(life)).comments.find(
          (c) => c.id === r.parentCommentId,
        ),
        reply = parent.item_comment.find((c) => c.content === content);
      assert(reply);
      assert.equal(Object.keys(reply.att_file).length, 1);
      r.replyId = reply.id;
      r.commentIds = [r.parentCommentId, reply.id];
      save();
      record("reply-with-real-attachment-persists", {
        id: life,
        replyId: reply.id,
      });
    }
    if (!has("edit-own-comment-and-remove-existing-file-persists")) {
      const p = await goto(creator, life, "discussion"),
        article = p.getByRole("article", {
          name: "Phản hồi của " + creator,
          exact: true,
        });
      await article.hover();
      await article
        .getByRole("button", {
          name: "Chỉnh sửa phản hồi của " + creator,
          exact: true,
        })
        .click();
      const dialog = p.getByRole("dialog", {
        name: "Chỉnh sửa bình luận",
        exact: true,
      });
      await dialog
        .getByLabel("Nội dung bình luận", { exact: true })
        .fill(r.prefix + " comment edited");
      await dialog.getByRole("button", { name: /^Bỏ tệp cũ / }).click();
      await dialog
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await dialog.waitFor({ state: "hidden" });
      const parent = (await get(life)).comments.find(
        (c) => c.id === r.parentCommentId,
      );
      assert.equal(parent.content, r.prefix + " comment edited");
      assert.equal(Object.keys(parent.att_file).length, 0);
      record("edit-own-comment-and-remove-existing-file-persists", {
        id: life,
        commentId: parent.id,
      });
    }
    if (!has("edit-own-reply-and-remove-existing-file-persists")) {
      const p = await goto(admin, life, "discussion"),
        article = p.getByRole("article", {
          name: "Phản hồi của admin",
          exact: true,
        });
      await article.hover();
      await article
        .getByRole("button", {
          name: "Chỉnh sửa phản hồi của admin",
          exact: true,
        })
        .click();
      const dialog = p.getByRole("dialog", {
        name: "Chỉnh sửa bình luận",
        exact: true,
      });
      await dialog
        .getByLabel("Nội dung bình luận", { exact: true })
        .fill(r.prefix + " reply edited");
      await dialog.getByRole("button", { name: /^Bỏ tệp cũ / }).click();
      await dialog
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await dialog.waitFor({ state: "hidden" });
      const reply = (await get(life)).comments
        .find((c) => c.id === r.parentCommentId)
        .item_comment.find((c) => c.id === r.replyId);
      assert.equal(reply.content, r.prefix + " reply edited");
      assert.equal(Object.keys(reply.att_file).length, 0);
      record("edit-own-reply-and-remove-existing-file-persists", {
        id: life,
        replyId: reply.id,
      });
    }
    if (!has("reader-cannot-edit-other-users-comments")) {
      const p = await goto(reader, life, "discussion");
      assert.equal(
        await p
          .getByRole("button", { name: /^Chỉnh sửa phản hồi của / })
          .count(),
        0,
      );
      record("reader-cannot-edit-other-users-comments", { id: life });
    }
    if (!has("real-mention-search-and-select")) {
      const p = await goto(creator, life, "discussion"),
        composer = p.getByRole("form", { name: "Phản hồi mới", exact: true });
      await composer.getByLabel("Phản hồi", { exact: true }).fill("@" + a);
      const option = p.getByRole("option").filter({ hasText: a }).first();
      await option.waitFor();
      await option.click();
      assert(
        (
          await composer.getByLabel("Phản hồi", { exact: true }).inputValue()
        ).includes("@" + a),
      );
      record("real-mention-search-and-select", { id: life, username: a });
    }
    if (process.argv[2] === "core") return;

    if (!has("approve-double-click-only-one-real-post")) {
      const p = await goto(reader, approvalUI);
      await p.getByRole("button", { name: "Phê duyệt", exact: true }).click();
      const d = p.getByRole("dialog").last(),
        before = count("/api/accept_ticket/", approvalUI);
      await d
        .getByRole("button", { name: "Phê duyệt", exact: true })
        .evaluate((el) => {
          el.click();
          el.click();
        });
      await d.waitFor({ state: "hidden" });
      assert.equal(count("/api/accept_ticket/", approvalUI), before + 1);
      const result = await state(approvalUI);
      assert.equal(result.status, 2);
      record("approve-double-click-only-one-real-post", {
        actor: reader,
        ...result,
      });
    }
    if (!has("designated-approver-accepts-main-ticket")) {
      await api(accept, "/accept_ticket/", { ticket_id: life });
      const result = await state(life);
      assert.equal(result.status, 2);
      record("designated-approver-accepts-main-ticket", {
        actor: accept,
        method: "real-api-designated-approver",
        ...result,
      });
    }
    await act("receive-approved-ticket", admin, life, "Tiếp nhận", null, 3);
    if (!has("sole-handler-cannot-be-deleted-and-empty-add-is-rejected")) {
      const p = await goto(admin, life);
      await p.getByRole("button", { name: "Phân công", exact: true }).click();
      const d = p.getByRole("dialog").last();
      await d
        .getByRole("combobox", { name: "Loại phân công", exact: true })
        .click();
      assert.equal(
        await p
          .getByRole("option", { name: "Xóa người xử lý", exact: true })
          .getAttribute("aria-disabled"),
        "true",
      );
      await p.keyboard.press("Escape");
      const before = count("/api/assignment_ticket/", life);
      await d.getByRole("button", { name: "Phân công", exact: true }).click();
      await p.waitForFunction(
        () =>
          document
            .getElementById("ticket-assignment-users")
            ?.getAttribute("aria-describedby") ===
          "ticket-assignment-users-error",
      );
      assert.equal(count("/api/assignment_ticket/", life), before);
      await d.getByRole("button", { name: "Thoát", exact: true }).click();
      record("sole-handler-cannot-be-deleted-and-empty-add-is-rejected", {
        id: life,
      });
    }
    if (!has("processing-fields-save-and-locked-field-stays-unchanged")) {
      const p = await goto(admin, life, "details"),
        section = p
          .getByRole("heading", { name: "Xử lý TEST", exact: true })
          .locator('xpath=ancestor::div[@data-slot="card"][1]');
      await section
        .getByRole("button", { name: "Chỉnh sửa", exact: true })
        .click();
      assert.equal(await p.locator("#detail-0-f15").isDisabled(), true);
      await p.locator("#detail-0-f13").fill(r.prefix + " processing public");
      await p.locator("#detail-0-f14").fill(r.prefix + " processing private");
      await section
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await section
        .getByRole("button", { name: "Chỉnh sửa", exact: true })
        .waitFor();
      const t = await get(life);
      assert.equal(
        t.data_item.dataform.data[0]["Kết quả công khai"],
        r.prefix + " processing public",
      );
      assert.equal(t.data_item.dataform.data[0]["Khóa thay đổi"], "");
      record("processing-fields-save-and-locked-field-stays-unchanged", {
        id: life,
      });
    }
    await act(
      "assignment-add-a",
      admin,
      life,
      "Phân công",
      async (d) => multi(d, "Người nhận xử lý", [await candidate(life, "a")]),
      3,
    );
    if (!has("assignment-change-empty-reason-no-post")) {
      const p = await goto(admin, life);
      await p.getByRole("button", { name: "Phân công", exact: true }).click();
      const d = p.getByRole("dialog").last();
      await select(d, "Loại phân công", "Thay đổi người xử lý");
      await select(d, "Người đang xử lý", a);
      await select(d, "Người nhận xử lý mới", await candidate(life, "b"));
      const before = count("/api/change_assignment_ticket/", life);
      await d.getByRole("button", { name: "Phân công", exact: true }).click();
      await p.waitForFunction(
        () =>
          document
            .getElementById("ticket-assignment-reason")
            ?.getAttribute("aria-invalid") === "true",
      );
      assert.equal(count("/api/change_assignment_ticket/", life), before);
      await d.getByRole("button", { name: "Thoát", exact: true }).click();
      record("assignment-change-empty-reason-no-post", { id: life });
    }
    await act(
      "assignment-change-a-to-b",
      admin,
      life,
      "Phân công",
      async (d) => {
        await select(d, "Loại phân công", "Thay đổi người xử lý");
        await select(d, "Người đang xử lý", a);
        await select(d, "Người nhận xử lý mới", await candidate(life, "b"));
        await d
          .getByRole("textbox", { name: /Lý do thay đổi/ })
          .fill(r.prefix + " change a to b");
      },
      3,
    );
    await act(
      "assignment-add-a-again",
      admin,
      life,
      "Phân công",
      async (d) => multi(d, "Người nhận xử lý", [await candidate(life, "a")]),
      3,
    );
    await act(
      "assignment-delete-a-only",
      admin,
      life,
      "Phân công",
      async (d) => {
        await select(d, "Loại phân công", "Xóa người xử lý");
        await multi(d, "Người cần xóa khỏi yêu cầu", [a]);
        await d
          .getByRole("textbox", { name: /Lý do xóa/ })
          .fill(r.prefix + " remove a");
      },
      3,
    );
    if (!has("assignment-readback-matches-selected-users")) {
      const t = await get(life);
      const active = t.list_user_received
        .filter((u) => u.status === "Đang xử lý")
        .map((u) => u.username)
        .sort();
      assert.deepEqual(active, [admin, b].sort());
      const history = await api(
        admin,
        "/list_ticket_history/?ticket_id=" + life,
      );
      assert(JSON.stringify(history).includes(r.prefix + " remove a"));
      record("assignment-readback-matches-selected-users", {
        id: life,
        active,
        removalReasonInHistory: true,
      });
    }
    if (!has("forward-admin-to-a")) {
      let t = await get(life);
      if (
        !t.list_user_received.some(
          (u) => u.username === a && u.status === "Đang xử lý",
        )
      ) {
        const p = await goto(admin, life);
        await p
          .getByRole("button", { name: "Hoàn thành", exact: true })
          .click();
        const d = p.getByRole("dialog").last();
        await d
          .getByRole("button", { name: "Chuyển tiếp", exact: true })
          .click();
        await select(d, "Người nhận chuyển tiếp", await candidate(life, "a"));
        await d
          .getByRole("button", { name: "Chuyển tiếp", exact: true })
          .click();
        await d.waitFor({ state: "hidden" });
        t = await get(life);
      }
      assert(
        t.list_user_received.some(
          (u) => u.username === a && u.status === "Đang xử lý",
        ),
      );
      assert.equal(count("/api/forward_ticket/", life), 1);
      record("forward-admin-to-a", {
        ...(await state(life)),
        observedBehavior:
          "Recipient is assigned; sender remains active and must complete separately",
      });
    }
    await act("complete-forwarding-admin", admin, life, "Hoàn thành", null, 3);
    await act("complete-handler-a", a, life, "Hoàn thành", null, 3);
    await act("complete-last-handler-b", b, life, "Hoàn thành", null, 5);
    if (!has("reopen-requires-reason")) {
      const p = await goto(creator, life);
      await p.getByRole("button", { name: "Xử lý lại", exact: true }).click();
      const d = p.getByRole("dialog").last(),
        before = count("/api/reprocess_ticket/", life);
      await d.getByRole("button", { name: "Xử lý lại", exact: true }).click();
      await p.waitForFunction(
        () =>
          document
            .querySelector('[aria-label="Xử lý lại yêu cầu"] textarea')
            ?.getAttribute("aria-invalid") === "true",
      );
      assert.equal(count("/api/reprocess_ticket/", life), before);
      await d.getByRole("button", { name: "Thoát", exact: true }).click();
      record("reopen-requires-reason", { id: life });
    }
    await act(
      "reopen-with-persisted-reason",
      creator,
      life,
      "Xử lý lại",
      (d) => d.getByRole("textbox").fill(r.prefix + " reopen first"),
      6,
    );
    assert((await get(life)).lydoxulylai.includes(r.prefix));
    await act(
      "manager-declines-reopen-with-reason",
      admin,
      life,
      "Hoàn thành",
      (d) => d.getByRole("textbox").fill(r.prefix + " decline first"),
      5,
    );
    if (!has("decline-reopen-reason-visible-in-data-or-history")) {
      const t = await get(life),
        history = await api(admin, "/list_ticket_history/?ticket_id=" + life);
      const present =
        String(t.lydokhongxulylai ?? "").includes(
          r.prefix + " decline first",
        ) || JSON.stringify(history).includes(r.prefix + " decline first");
      assert(present, "Decline reason lost by server");
      record("decline-reopen-reason-visible-in-data-or-history", {
        id: life,
        field: t.lydokhongxulylai,
        historyContainsReason: JSON.stringify(history).includes(
          r.prefix + " decline first",
        ),
      });
    }
    await act(
      "reopen-second-cycle",
      creator,
      life,
      "Xử lý lại",
      (d) => d.getByRole("textbox").fill(r.prefix + " reopen second"),
      6,
    );
    await act(
      "handler-a-receives-reopened-ticket",
      a,
      life,
      "Tiếp nhận",
      null,
      3,
    );
    await act(
      "handler-a-completes-reopened-ticket",
      a,
      life,
      "Hoàn thành",
      null,
      5,
    );
    await act(
      "creator-closes-completed-ticket",
      creator,
      life,
      "Đóng",
      null,
      7,
    );
    if (!has("closed-ticket-has-no-status-or-edit-actions")) {
      const p = await goto(creator, life);
      assert.equal(
        await p
          .getByRole("button", { name: "Đổi ngày mong muốn", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await p
          .getByRole("group", { name: "Thao tác yêu cầu", exact: true })
          .count(),
        0,
      );
      await p
        .getByRole("tab", { name: "Chi tiết yêu cầu", exact: true })
        .click();
      assert.equal(
        await p.getByRole("button", { name: "Chỉnh sửa", exact: true }).count(),
        0,
      );
      record("closed-ticket-has-no-status-or-edit-actions", { id: life });
    }
    if (!has("cancel-empty-reason-no-api")) {
      const p = await goto(creator, cancel);
      await p.getByRole("button", { name: "Hủy", exact: true }).click();
      const d = p.getByRole("dialog").last(),
        before = count("/api/cancel_ticket/", cancel);
      await d.getByRole("button", { name: "Hủy", exact: true }).click();
      await p.waitForFunction(
        () =>
          document
            .querySelector('[aria-label="Hủy yêu cầu"] textarea')
            ?.getAttribute("aria-invalid") === "true",
      );
      assert.equal(count("/api/cancel_ticket/", cancel), before);
      await d.getByRole("button", { name: "Thoát", exact: true }).click();
      record("cancel-empty-reason-no-api", { id: cancel });
    }
    if (!has("cancel-retry-skips-already-uploaded-file")) {
      const p = await goto(creator, cancel);
      await p.getByRole("button", { name: "Hủy", exact: true }).click();
      const d = p.getByRole("dialog").last();
      await d.getByRole("textbox").fill(r.prefix + " cancellation reason");
      await d
        .locator("input[type=file]")
        .setInputFiles(
          file("cancel.txt", "Real cancellation evidence " + r.prefix),
        );
      const uploadBefore = count("/api/attachmentticketfile", cancel);
      fault = {
        path: "/api/cancel_ticket/",
        ticketId: cancel,
        name: "TEST controlled cancel offline after file upload",
      };
      await d.getByRole("button", { name: "Hủy", exact: true }).click();
      await d
        .getByRole("button", { name: "Thử lại phần còn lại", exact: true })
        .waitFor();
      assert.equal(
        count("/api/attachmentticketfile", cancel),
        uploadBefore + 1,
      );
      assert.equal((await get(cancel)).ticket_status, 1);
      await d
        .getByRole("button", { name: "Thử lại phần còn lại", exact: true })
        .click();
      await d.waitFor({ state: "hidden" });
      const t = await get(cancel);
      assert.equal(t.ticket_status, 4);
      assert.equal(t.lydohuyyeucau, r.prefix + " cancellation reason");
      assert(t.attachment_files[r.prefix + "_cancel.txt"]);
      assert.equal(
        count("/api/attachmentticketfile", cancel),
        uploadBefore + 1,
      );
      record("cancel-retry-skips-already-uploaded-file", {
        id: cancel,
        status: 4,
        uploads: 1,
      });
    }
    if (!has("manager-branch-approve")) {
      await api(accept, "/accept_ticket/", { ticket_id: manager });
      const result = await state(manager);
      assert.equal(result.status, 2);
      record("manager-branch-approve", {
        actor: accept,
        method: "real-api-designated-approver",
        ...result,
      });
    }
    await act("manager-branch-receive", admin, manager, "Tiếp nhận", null, 3);
    await act(
      "manager-branch-add-a",
      admin,
      manager,
      "Phân công",
      async (d) =>
        multi(d, "Người nhận xử lý", [await candidate(manager, "a")]),
      3,
    );
    await act(
      "manager-branch-admin-completes",
      admin,
      manager,
      "Hoàn thành",
      null,
      3,
    );
    if (!has("remove-all-active-retry-only-replacement-step")) {
      const p = await goto(admin, manager);
      await p.getByRole("button", { name: "Phân công", exact: true }).click();
      const d = p.getByRole("dialog").last();
      await select(d, "Loại phân công", "Xóa người xử lý");
      await multi(d, "Người cần xóa khỏi yêu cầu", [a]);
      await d
        .getByRole("textbox", { name: /Lý do xóa/ })
        .fill(r.prefix + " replace all active");
      await multi(d, "Người nhận xử lý thay thế", [
        await candidate(manager, "b"),
      ]);
      const deletedBefore = count("/api/delete_assignment_ticket/", manager),
        assignedBefore = count("/api/assignment_ticket/", manager);
      fault = {
        path: "/api/assignment_ticket/",
        ticketId: manager,
        name: "TEST controlled replacement offline after deletion",
      };
      await d.getByRole("button", { name: "Phân công", exact: true }).click();
      await d
        .getByRole("button", { name: "Thử lại phần còn lại", exact: true })
        .waitFor();
      assert.equal(
        count("/api/delete_assignment_ticket/", manager),
        deletedBefore + 1,
      );
      assert.equal(count("/api/assignment_ticket/", manager), assignedBefore);
      await d
        .getByRole("button", { name: "Thử lại phần còn lại", exact: true })
        .click();
      await d.waitFor({ state: "hidden" });
      const t = await get(manager);
      assert.equal(
        count("/api/delete_assignment_ticket/", manager),
        deletedBefore + 1,
      );
      assert.equal(
        count("/api/assignment_ticket/", manager),
        assignedBefore + 1,
      );
      assert(
        t.list_user_received.some(
          (u) => u.username === b && u.status === "Đang xử lý",
        ),
      );
      record("remove-all-active-retry-only-replacement-step", {
        id: manager,
        deleteRequests: 1,
        replacementRequests: 1,
      });
    }
    await act(
      "manager-branch-add-a-again",
      admin,
      manager,
      "Phân công",
      async (d) =>
        multi(d, "Người nhận xử lý", [await candidate(manager, "a")]),
      3,
    );
    await act("manager-branch-b-completes", b, manager, "Hoàn thành", null, 3);
    await act(
      "manager-removes-all-active-and-completes-request",
      admin,
      manager,
      "Phân công",
      async (d) => {
        await select(d, "Loại phân công", "Xóa người xử lý");
        await multi(d, "Người cần xóa khỏi yêu cầu", [a]);
        await d
          .getByRole("textbox", { name: /Lý do xóa/ })
          .fill(r.prefix + " manager done after delete");
      },
      5,
    );
    await act("manager-branch-close", creator, manager, "Đóng", null, 7);
    if (!has("review-approve")) {
      await api(accept, "/accept_ticket/", { ticket_id: review });
      const result = await state(review);
      assert.equal(result.status, 2);
      record("review-approve", {
        actor: accept,
        method: "real-api-designated-approver",
        ...result,
      });
    }
    await act("review-receive", admin, review, "Tiếp nhận", null, 3);
    await act(
      "review-add-a-leave-b-available",
      admin,
      review,
      "Phân công",
      async (d) => multi(d, "Người nhận xử lý", [await candidate(review, "a")]),
      3,
    );
    if (!has("review-ticket-left-open-with-all-three-assignment-modes")) {
      const p = await goto(admin, review);
      await p.getByRole("button", { name: "Phân công", exact: true }).click();
      const d = p.getByRole("dialog").last();
      await d
        .getByRole("combobox", { name: "Loại phân công", exact: true })
        .click();
      for (const name of [
        "Thêm người xử lý",
        "Thay đổi người xử lý",
        "Xóa người xử lý",
      ])
        assert.notEqual(
          await p
            .getByRole("option", { name, exact: true })
            .getAttribute("aria-disabled"),
          "true",
        );
      await p.keyboard.press("Escape");
      await d.getByRole("button", { name: "Thoát", exact: true }).click();
      record("review-ticket-left-open-with-all-three-assignment-modes", {
        id: review,
        url: "http://localhost:5173/requests/" + review,
      });
    }
    if (!has("final-readback-and-history-all-test-tickets")) {
      const final = [];
      for (const entry of r.tickets) {
        const result = await state(entry.id),
          t = await get(entry.id);
        assert(t.title.startsWith(r.prefix));
        assert(result.historyEntries > 0);
        final.push({ ...result, code: entry.code, scenario: entry.scenario });
      }
      assert.equal(final.find((t) => t.id === life).status, 7);
      assert.equal(final.find((t) => t.id === cancel).status, 4);
      assert.equal(final.find((t) => t.id === manager).status, 7);
      assert.equal(final.find((t) => t.id === review).status, 3);
      r.finalTickets = final;
      record("final-readback-and-history-all-test-tickets", { tickets: final });
    }
    r.status = r.securityFindings?.length
      ? "completed-with-security-failure"
      : "passed";
    r.completedAt = new Date().toISOString();
    delete r.error;
    save();
    if (r.checks.some((check) => check.status === "failed"))
      process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  r.status = "failed";
  r.error = e.message;
  r.attemptFailures.push({ at: new Date().toISOString(), error: e.message });
  save();
  console.error(e.stack);
  process.exitCode = 1;
});
