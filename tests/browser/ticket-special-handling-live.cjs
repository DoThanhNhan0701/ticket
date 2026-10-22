// Live API/UI regression for special handling groups 5, 18 and 20.
// Requires explicit authorization to temporarily update their manager/member configuration.
// Run against a Vite dev server; pass QA credentials as a JSON object on stdin.
// SPECIAL_REPORT is resumable state outside the watched source tree. Never delete it mid-run.
// Existing real members are preserved; original configuration is restored and read back.
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const work =
    process.env.SPECIAL_REPORT || "/tmp/special-handling-live-state.json",
  root = process.env.API_URL || "https://ticket-api.aiminds.io.vn/api",
  base = process.env.BASE_URL || "http://127.0.0.1:5198";
// Explicitly authorized tests on real special departments; original members are preserved.
// Credentials arrive on stdin. Work state must remain outside Vite's watched tree.
const r = fs.existsSync(work)
  ? JSON.parse(fs.readFileSync(work, "utf8"))
  : {
      prefix: "TEST_SPEC_" + Date.now().toString(36).slice(-6).toUpperCase(),
      cases: {},
      checks: [],
      writes: [],
      attemptFailures: [],
      runtimeErrors: [],
      startedAt: new Date().toISOString(),
    };
const save = () => fs.writeFileSync(work, JSON.stringify(r, null, 2) + "\n");
const record = (g, name, detail = {}) => {
  const value = { groupId: g, name, status: "passed", ...detail },
    i = r.checks.findIndex((c) => c.groupId === g && c.name === name);
  if (i < 0) r.checks.push(value);
  else r.checks[i] = value;
  save();
  console.log(JSON.stringify({ groupId: g, name, status: "passed" }));
};
const shape = (g) => ({
  name: g.name,
  description: g.description,
  is_active: g.is_active,
  is_manager: g.is_manager,
  group_email: g.group_email,
  ls_member: [...g.ls_member],
});
const equalConfig = (a, b) =>
  assert.deepEqual(
    { ...a, ls_member: [...a.ls_member].sort((x, y) => x - y) },
    { ...b, ls_member: [...b.ls_member].sort((x, y) => x - y) },
  );
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8")),
    auth = {};
  const admin = "admin",
    creator = "test_p261021_all",
    approver = "test_form20_reader_ivdviv",
    a = "test_act22_a_iwa0tx",
    b = "test_act22_b_iwa0tx",
    c = "test_handling_ixwmue",
    qa = [817, 818, 819];
  for (const [user, password] of Object.entries(credentials)) {
    const resp = await fetch(root + "/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password }),
    });
    assert(resp.ok, "Login " + user + " " + resp.status);
    auth[user] = await resp.json();
  }
  const own = (id) =>
    Object.values(r.cases).some((x) => x.ticketId === Number(id));
  const api = async (user, path, body, method = "POST") => {
    if (body !== undefined) {
      let allowed = false;
      const id = Number(path.split("/").at(-1)),
        fixture = r.cases[id];
      if (
        path.startsWith("/handlinggroupmmanager/") &&
        fixture &&
        [5, 18, 20].includes(id) &&
        method === "PUT"
      ) {
        const original = fixture.original;
        allowed =
          original &&
          body.name === original.name &&
          body.description === original.description &&
          body.group_email === original.group_email &&
          body.is_active === original.is_active &&
          [original.is_manager, 817, 818].includes(body.is_manager) &&
          original.ls_member.every((x) => body.ls_member.includes(x)) &&
          body.ls_member.every((x) =>
            [...original.ls_member, original.is_manager, ...qa].includes(x),
          );
      }
      if (path === "/tickettypemmanager/")
        allowed =
          body instanceof FormData &&
          body.get("name").startsWith(r.prefix) &&
          [5, 18, 20].includes(Number(body.get("handling_group")));
      if (path === "/template_form/")
        allowed = Object.values(r.cases).some(
          (x) => x.typeId === body.ticket_type,
        );
      assert(allowed, "Node write outside authorized TEST scope " + path);
    }
    const resp = await fetch(root + path, {
      signal: AbortSignal.timeout(15000),
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
    const data = await resp.json();
    if (body !== undefined) {
      r.writes.push({
        transport: "setup-or-config",
        actor: user,
        path,
        method,
        httpStatus: resp.status,
        body: body instanceof FormData ? Object.fromEntries(body) : body,
      });
      save();
    }
    assert(resp.ok, path + " " + resp.status + " " + JSON.stringify(data));
    assert(!data.error, path + " " + data.error);
    return data;
  };
  const browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
        : {}),
      args: ["--no-sandbox"],
    }),
    pages = {};
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
        path = new URL(req.url()).pathname;
      if (req.method() === "GET") return route.continue();
      let body;
      try {
        body = req.postDataJSON();
      } catch {
        body = null;
      }
      let allowed = own(body?.ticket_id);
      if (body?.ls_user_assignment)
        allowed =
          allowed &&
          body.ls_user_assignment.every((id) => qa.includes(Number(id)));
      if (body?.user_forward)
        allowed = allowed && qa.includes(Number(body.user_forward));
      const entry = Object.entries(r.cases).find(
        ([, x]) => x.typeId === body?.ticket_type,
      );
      if (path === "/api/ticket_manager")
        allowed = Boolean(
          entry &&
          body?.title === r.prefix + " " + entry[0] &&
          body.handling_group === Number(entry[0]) &&
          !entry[1].ticketId,
        );
      if (!allowed) {
        r.blocked = r.blocked || [];
        r.blocked.push({ path, actor: user });
        save();
        return route.abort();
      }
      const response = await route.fetch();
      let data;
      try {
        data = await response.json();
      } catch {
        data = { nonJson: true };
      }
      r.writes.push({
        transport: "browser",
        actor: user,
        path,
        method: req.method(),
        ticketId: body?.ticket_id ?? data.id,
        httpStatus: response.status(),
        body,
      });
      if (path === "/api/ticket_manager" && response.ok() && data.id) {
        entry[1].ticketId = data.id;
        entry[1].ticketCode = data.ticket_code;
        save();
      }
      save();
      return route.fulfill({ response, json: data });
    });
    const p = await context.newPage();
    p.on("pageerror", (error) => {
      r.runtimeErrors.push(error.message);
      save();
    });
    pages[user] = p;
    return p;
  };
  const get = (id) => api(admin, "/ticket_manager/" + id);
  const goto = async (user, id, tab = "general") => {
    const p = await pageFor(user);
    await p.goto(base + "/requests/" + id + "?tab=" + tab);
    await p
      .getByRole("tab", { name: "Thông tin chung", exact: true })
      .waitFor();
    return p;
  };
  const actionButtons = (p) =>
    p
      .getByRole("group", { name: "Thao tác yêu cầu", exact: true })
      .getByRole("button");
  const expectActions = async (g, name, user, id, expected) => {
    const p = await goto(user, id),
      actual = await actionButtons(p).allTextContents();
    assert.deepEqual(actual, [...expected], name + " actual actions");
    record(g, name, { actor: user, actions: actual });
    return p;
  };
  const clickAction = async (user, id, name) => {
    const p = await goto(user, id);
    await p.getByRole("button", { name, exact: true }).click();
    const d = p.getByRole("dialog").last();
    await d.getByRole("button", { name, exact: true }).click();
    await d.waitFor({ state: "hidden" });
    return p;
  };
  try {
    for (const groupId of [5, 18, 20]) {
      let fixture = r.cases[groupId];
      // Recover an interrupted restoration before resuming or skipping a completed case.
      if (fixture?.restoreRequired) {
        await api(
          admin,
          "/handlinggroupmmanager/" + groupId,
          fixture.original,
          "PUT",
        );
        equalConfig(
          shape(await api(admin, "/handlinggroupmmanager/" + groupId)),
          fixture.original,
        );
        fixture.restoreRequired = false;
        fixture.restoredAt = new Date().toISOString();
        record(groupId, "original-production-department-config-restored");
      }
      if (fixture?.done) {
        equalConfig(
          shape(await api(admin, "/handlinggroupmmanager/" + groupId)),
          fixture.original,
        );
        continue;
      }
      if (!fixture) {
        fixture = {
          original: shape(
            await api(admin, "/handlinggroupmmanager/" + groupId),
          ),
        };
        r.cases[groupId] = fixture;
        save();
      }
      equalConfig(
        shape(await api(admin, "/handlinggroupmmanager/" + groupId)),
        fixture.original,
      );
      if (!fixture.typeId) {
        const body = new FormData();
        body.set("name", r.prefix + "_" + groupId);
        body.set("handling_group", String(groupId));
        body.set("is_active", "true");
        fixture.typeId = (await api(admin, "/tickettypemmanager/", body)).id;
        assert(fixture.typeId);
        save();
      }
      if (!fixture.templateSaved) {
        await api(admin, "/template_form/", {
          ticket_type: fixture.typeId,
          user: 334,
          data_form: {
            forms: [
              {
                title: "Thông tin TEST",
                editable: true,
                children: [
                  {
                    title: "Nội dung TEST",
                    type: "text",
                    required: true,
                    handling: false,
                    status: false,
                    editable: true,
                  },
                ],
              },
              {
                title: "Xử lý TEST",
                editable: false,
                children: [
                  {
                    title: "Kết quả TEST",
                    type: "text",
                    required: true,
                    handling: true,
                    status: false,
                    editable: false,
                  },
                ],
              },
            ],
          },
          mota: r.prefix,
          ghichu: "Special department state 8 browser regression",
        });
        fixture.templateSaved = true;
        save();
      }
      if (!fixture.ticketId) {
        const p = await pageFor(creator);
        await p.goto(base + "/requests/new");
        await p.locator("#create-handling_group").waitFor();
        await p.evaluate(
          async ({ groupId, typeId, prefix }) => {
            const d =
              await import("/src/features/requests/utils/request-create-draft.ts");
            d.writeRequestDraft(
              d.requestDraftKey(811, null),
              d.createDraft(
                {
                  handling_group: String(groupId),
                  ticket_type: String(typeId),
                  approve_user: "816",
                  fore_cus: "2",
                  bophansudung: "31",
                  other1: ["89"],
                  vanphong: "8",
                  title: prefix + " " + groupId,
                  description: "TEST special 2 → 8 → 3 → 5 → 7",
                  duedate: "25/11/2026",
                  rows: [{ values: { f0: prefix + " detail " + groupId } }],
                },
                [],
                crypto.randomUUID(),
              ),
            );
          },
          { groupId, typeId: fixture.typeId, prefix: r.prefix },
        );
        await p.goto(base + "/requests/new");
        await p.locator("#detail-0-f0").waitFor();
        await p
          .getByRole("button", { name: "Tạo yêu cầu", exact: true })
          .click();
        await p.waitForURL(/\/requests(?:\/\d+)?$/);
        assert(fixture.ticketId);
        record(groupId, "create-test-ticket-through-ui", {
          ticketId: fixture.ticketId,
        });
      }
      const id = fixture.ticketId;
      let touched = false;
      const setConfig = async (manager, members) => {
        const body = {
          ...fixture.original,
          is_manager: manager,
          ls_member: [
            ...new Set([
              ...fixture.original.ls_member,
              fixture.original.is_manager,
              ...members,
            ]),
          ],
        };
        fixture.restoreRequired = true;
        save();
        touched = true;
        await api(admin, "/handlinggroupmmanager/" + groupId, body, "PUT");
        equalConfig(
          shape(await api(admin, "/handlinggroupmmanager/" + groupId)),
          body,
        );
      };
      const restoreOriginal = async () => {
        let error;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await api(
              admin,
              "/handlinggroupmmanager/" + groupId,
              fixture.original,
              "PUT",
            );
            equalConfig(
              shape(await api(admin, "/handlinggroupmmanager/" + groupId)),
              fixture.original,
            );
            fixture.restoreRequired = false;
            fixture.restoredAt = new Date().toISOString();
            record(groupId, "original-production-department-config-restored");
            error = null;
            break;
          } catch (e) {
            error = e;
          }
        }
        if (error) throw error;
      };
      try {
        await setConfig(817, [817, 818]);
        let t = await get(id);
        if (t.ticket_status === 1) {
          await clickAction(approver, id, "Phê duyệt");
          t = await get(id);
          assert.equal(t.ticket_status, 2);
          record(groupId, "approve-through-ui");
        }
        if (t.ticket_status === 2) {
          await expectActions(
            groupId,
            "approved-manager-receive-without-assignment",
            a,
            id,
            ["Tiếp nhận", "Hủy"],
          );
          await expectActions(
            groupId,
            "approved-member-cannot-self-receive",
            b,
            id,
            [],
          );
          await expectActions(
            groupId,
            "approved-outsider-no-actions",
            c,
            id,
            [],
          );
          await clickAction(a, id, "Tiếp nhận");
          t = await get(id);
          assert.equal(t.ticket_status, 8);
          assert.equal(t.list_user_received.length, 0);
          record(groupId, "receive-is-status-8-and-does-not-assign-manager", {
            ticketStatus: t.ticket_status,
            handlers: t.list_user_received,
          });
        }
        if (t.ticket_status === 8) {
          const ap = await expectActions(
            groupId,
            "received-manager-only-assignment",
            a,
            id,
            ["Phân công"],
          );
          assert(
            (
              await ap
                .getByRole("group", { name: "Trạng thái yêu cầu", exact: true })
                .innerText()
            ).includes(t.ticket_status_name),
          );
          await expectActions(
            groupId,
            "received-member-awaits-assignment",
            b,
            id,
            [],
          );
          await ap
            .getByRole("tab", { name: "Chi tiết yêu cầu", exact: true })
            .click();
          await ap
            .getByRole("heading", { name: "Xử lý TEST", exact: true })
            .waitFor();
          assert.equal(
            await ap
              .getByRole("button", { name: "Chỉnh sửa", exact: true })
              .count(),
            0,
          );
          record(groupId, "received-manager-not-treated-as-editing-processor");
          await ap
            .getByRole("button", { name: "Phân công", exact: true })
            .click();
          let d = ap.getByRole("dialog").last();
          await d
            .getByRole("combobox", { name: "Loại phân công", exact: true })
            .click();
          for (const option of ["Xóa người xử lý", "Thay đổi người xử lý"])
            assert.equal(
              await ap
                .getByRole("option", { name: option, exact: true })
                .getAttribute("aria-disabled"),
              "true",
            );
          await ap.keyboard.press("Escape");
          const before = r.writes.filter(
            (w) => w.path === "/api/assignment_ticket/" && w.ticketId === id,
          ).length;
          await d
            .getByRole("button", { name: "Phân công", exact: true })
            .click();
          await ap.waitForFunction(
            () =>
              document
                .getElementById("ticket-assignment-users")
                ?.getAttribute("aria-describedby") ===
              "ticket-assignment-users-error",
          );
          assert.equal(
            r.writes.filter(
              (w) => w.path === "/api/assignment_ticket/" && w.ticketId === id,
            ).length,
            before,
          );
          await d.getByRole("button", { name: "Thoát", exact: true }).click();
          record(
            groupId,
            "received-disables-change-delete-and-validates-empty-add",
          );
          await setConfig(818, [817, 818]);
          await expectActions(
            groupId,
            "received-old-manager-loses-assignment",
            a,
            id,
            [],
          );
          await expectActions(
            groupId,
            "received-new-manager-gains-assignment",
            b,
            id,
            ["Phân công"],
          );
          await setConfig(818, [818]);
          t = await get(id);
          assert(
            !Object.values(t.list_user_not_received).map(Number).includes(817),
          );
          assert.equal(t.list_user_received.length, 0);
          await expectActions(
            groupId,
            "received-removed-member-has-no-actions",
            a,
            id,
            [],
          );
          record(
            groupId,
            "received-member-removal-updates-candidates-without-creating-handlers",
          );
          await setConfig(818, [817, 818]);
          const bp = await goto(b, id);
          await bp
            .getByRole("button", { name: "Phân công", exact: true })
            .click();
          d = bp.getByRole("dialog").last();
          await d
            .getByRole("button", { name: "Người nhận xử lý", exact: true })
            .click();
          for (const user of [a, b])
            await bp
              .getByRole("button", { name: user, exact: true, pressed: false })
              .click();
          await bp.keyboard.press("Escape");
          await d
            .getByRole("button", { name: "Phân công", exact: true })
            .click();
          await d.waitFor({ state: "hidden" });
          t = await get(id);
          assert.equal(t.ticket_status, 3);
          assert.deepEqual(
            t.list_user_received
              .filter((u) => u.status === "Đang xử lý")
              .map((u) => Number(u.user_id))
              .sort(),
            [817, 818],
          );
          record(
            groupId,
            "new-manager-assigns-two-test-users-and-enters-status-3",
            { handlers: t.list_user_received },
          );
        }
        t = await get(id);
        if (t.ticket_status === 3) {
          await setConfig(818, [817, 818, 819]);
          await expectActions(
            groupId,
            "processing-unassigned-member-cannot-self-receive",
            c,
            id,
            [],
          );
          const aActive = t.list_user_received.some(
            (u) => Number(u.user_id) === 817 && u.status === "Đang xử lý",
          );
          if (aActive) {
            const ap = await expectActions(
              groupId,
              "processing-assigned-member-can-complete",
              a,
              id,
              ["Hoàn thành"],
            );
            await ap
              .getByRole("tab", { name: "Chi tiết yêu cầu", exact: true })
              .click();
            await ap
              .getByRole("heading", { name: "Xử lý TEST", exact: true })
              .waitFor();
            await ap
              .getByRole("button", { name: "Chỉnh sửa", exact: true })
              .click();
            await ap
              .locator("#detail-0-f1")
              .fill(r.prefix + " RESULT " + groupId);
            await ap
              .getByRole("button", { name: "Lưu thay đổi", exact: true })
              .click();
            await ap
              .getByRole("button", { name: "Chỉnh sửa", exact: true })
              .waitFor();
            assert.equal(
              (await get(id)).data_item.dataform.data[0]["Kết quả TEST"],
              r.prefix + " RESULT " + groupId,
            );
            record(groupId, "assigned-member-edits-processing-section");
            await clickAction(a, id, "Hoàn thành");
            t = await get(id);
            assert.equal(t.ticket_status, 3);
            assert(
              t.list_user_received.some(
                (u) => Number(u.user_id) === 817 && u.status === "Hoàn thành",
              ),
            );
            record(groupId, "one-handler-done-ticket-still-processing");
          }
          await expectActions(
            groupId,
            "completed-member-cannot-complete-or-receive-again",
            a,
            id,
            [],
          );
          await expectActions(
            groupId,
            "assigned-manager-can-assign-cancel-and-complete",
            b,
            id,
            ["Phân công", "Hoàn thành", "Hủy"],
          );
          await clickAction(b, id, "Hoàn thành");
          t = await get(id);
          assert.equal(t.ticket_status, 5);
          record(groupId, "last-handler-completes-ticket");
        }
        if (t.ticket_status === 5) {
          await expectActions(
            groupId,
            "completed-creator-only-close-no-reprocess",
            creator,
            id,
            ["Đóng"],
          );
          await expectActions(
            groupId,
            "completed-manager-has-no-process-actions",
            b,
            id,
            [],
          );
          await clickAction(creator, id, "Đóng");
          t = await get(id);
          assert.equal(t.ticket_status, 7);
          record(groupId, "creator-closes-through-ui");
        }
        assert.equal(t.ticket_status, 7);
        await expectActions(
          groupId,
          "closed-ticket-no-actions",
          creator,
          id,
          [],
        );
        fixture.history = await api(
          admin,
          "/list_ticket_history/?ticket_id=" + id,
        );
        assert(
          fixture.history.some((x) => x.system_log?.includes("Đã tiếp nhận")),
        );
        assert(
          fixture.history.some((x) =>
            x.system_log?.includes("Phân công yêu cầu"),
          ),
        );
        fixture.finalTicketStatus = t.ticket_status;
        fixture.done = true;
        save();
      } finally {
        if (touched) {
          await restoreOriginal();
        }
      }
    }
    assert.equal(r.runtimeErrors.length, 0);
    assert(Object.values(r.cases).every((x) => x.done && !x.restoreRequired));
    r.status = "passed";
    r.completedAt = new Date().toISOString();
    delete r.error;
    save();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  r.status = "failed";
  r.error = e.message;
  r.attemptFailures.push({ at: new Date().toISOString(), message: e.message });
  save();
  console.error(e.stack);
  process.exitCode = 1;
});
