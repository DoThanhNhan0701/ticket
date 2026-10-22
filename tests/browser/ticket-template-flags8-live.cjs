const ticketTestEnv = require("../env.cjs");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const work = process.env.FLAGS_REPORT || "/tmp/ticket-flags8-live-state.json",
  base = ticketTestEnv.baseUrl,
  root = ticketTestEnv.apiUrl;
// Credentials map on stdin, isolated TEST type in existing TEST group 24 only.
const r = fs.existsSync(work)
  ? JSON.parse(fs.readFileSync(work, "utf8"))
  : {
      prefix: "TEST_FLAGS8_" + Date.now().toString(36).slice(-6).toUpperCase(),
      checks: [],
      tickets: [],
      writes: [],
      runtimeErrors: [],
      attemptFailures: [],
      startedAt: new Date().toISOString(),
    };
const combinations = Array.from({ length: 8 }, (_, mask) => ({
  name: `R${(mask >> 2) & 1}H${(mask >> 1) & 1}S${mask & 1}`,
  required: Boolean(mask & 4),
  handling: Boolean(mask & 2),
  status: Boolean(mask & 1),
}));
const save = () => fs.writeFileSync(work, JSON.stringify(r, null, 2) + "\n"),
  has = (name) =>
    r.checks.some((c) => c.name === name && c.status === "passed");
const record = (name, detail = {}) => {
  r.checks.push({ name, status: "passed", ...detail });
  save();
  console.log(name);
};
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8")),
    tokens = {};
  const admin = "admin",
    creator = "test_p261021_all",
    handler = "test_act22_a_iwa0tx",
    other = "test_act22_b_iwa0tx",
    approver = "test_form20_reader_ivdviv";
  for (const [user, password] of Object.entries(credentials)) {
    const resp = await fetch(root + "/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password }),
    });
    assert(resp.ok, "Login " + user + " " + resp.status);
    tokens[user] = await resp.json();
  }
  const api = async (user, path, body) => {
    if (body !== undefined) {
      assert(
        (path === "/tickettypemmanager/" &&
          body.get("name") === r.prefix &&
          body.get("handling_group") === "24") ||
          (path === "/template_form/" && body.ticket_type === r.typeId),
        "Outside TEST setup",
      );
    }
    const resp = await fetch(root + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: "Bearer " + tokens[user].access,
        ...(body !== undefined && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(body === undefined
        ? {}
        : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
    const data = await resp.json();
    assert(resp.ok, path + " " + resp.status);
    return data;
  };
  const get = (id) => api(admin, "/ticket_manager/" + id);
  if (!r.typeId) {
    const body = new FormData();
    body.set("name", r.prefix);
    body.set("handling_group", "24");
    body.set("is_active", "true");
    const type = await api(admin, "/tickettypemmanager/", body);
    assert(type.id);
    r.typeId = type.id;
    save();
  }
  if (!r.templateSeeded) {
    const forms = [true, false].map((editable, g) => ({
      title: g ? "Xử lý TEST8" : "Thông tin tạo TEST8",
      editable,
      children: combinations.map((c) => ({
        title: (g ? "Process " : "Create ") + c.name,
        type: "text",
        editable: true,
        required: false,
        handling: false,
        status: false,
      })),
    }));
    await api(admin, "/template_form/", {
      ticket_type: r.typeId,
      user: 334,
      data_form: { forms },
      mota: r.prefix,
      ghichu: "All 8 checkbox combinations, retained for review",
    });
    r.templateSeeded = true;
    save();
  }
  const browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
        : {}),
      args: ["--no-sandbox"],
    }),
    pages = {};
  const own = (id) => r.tickets.some((t) => t.id === Number(id));
  const pageFor = async (user) => {
    if (pages[user]) return pages[user];
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await ctx.addCookies([
      { name: "_access_token_ticket", value: tokens[user].access, url: base },
      { name: "_refresh_token_ticket", value: tokens[user].refresh, url: base },
    ]);
    await ctx.route("**/api/**", async (route) => {
      const q = route.request(),
        path = new URL(q.url()).pathname;
      if (q.method() === "GET") return route.continue();
      let b;
      try {
        b = q.postDataJSON();
      } catch {
        // Non-JSON writes fail the TEST ownership guard below.
      }
      let allowed =
        own(b?.ticket_id) ||
        (path === "/api/template_form/" + r.typeId &&
          b?.ticket_type === r.typeId);
      if (path === "/api/ticket_manager")
        allowed =
          b?.ticket_type === r.typeId &&
          b?.title.startsWith(r.prefix) &&
          r.tickets.length < 3;
      if (!allowed) {
        r.blocked = r.blocked || [];
        r.blocked.push({ path, method: q.method() });
        save();
        return route.abort();
      }
      if (path === "/api/ticket_manager") {
        const response = await route.fetch(),
          data = await response.json();
        if (response.ok() && data.id && !own(data.id)) {
          r.tickets.push({
            id: data.id,
            code: data.ticket_code,
            title: b.title,
          });
          save();
        }
        r.writes.push({
          path,
          method: q.method(),
          status: response.status(),
          ticketId: data.id,
        });
        save();
        return route.fulfill({ response, json: data });
      }
      const response = await route.fetch();
      r.writes.push({
        path,
        method: q.method(),
        status: response.status(),
        ticketId: b?.ticket_id,
      });
      save();
      return route.fulfill({ response });
    });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => {
      r.runtimeErrors.push(e.message);
      save();
    });
    pages[user] = p;
    return p;
  };
  const goto = async (user, id) => {
    const p = await pageFor(user);
    await p.goto(base + "/requests/" + id + "?tab=details");
    await p.getByRole("tab", { name: "Chi tiết yêu cầu", exact: true }).click();
    await p
      .getByRole("heading", { name: "Xử lý TEST8", exact: true })
      .waitFor();
    return p;
  };
  const action = async (name, user, id, label, status, reason) => {
    if (has(name)) return;
    const p = await goto(user, id);
    await p.getByRole("button", { name: label, exact: true }).click();
    const d = p.getByRole("dialog").last();
    if (reason) await d.getByRole("textbox").fill(reason);
    await d.getByRole("button", { name: label, exact: true }).click();
    await d.waitFor({ state: "hidden" });
    assert.equal((await get(id)).ticket_status, status);
    record(name, { ticketId: id, ticketStatus: status });
  };
  try {
    if (!has("configure-and-reopen-all-8-switch-combinations")) {
      const p = await pageFor(admin);
      await p.goto(
        base + "/settings/request-types?search=" + encodeURIComponent(r.prefix),
      );
      await p
        .getByRole("button", { name: "Biểu mẫu " + r.prefix, exact: true })
        .click();
      let d = p.getByRole("dialog").last();
      await d
        .getByRole("form", { name: "Cấu hình biểu mẫu", exact: true })
        .waitFor();
      for (let g = 0; g < 2; g++) {
        await d
          .getByRole("button", { name: "Mở rộng phần " + (g + 1), exact: true })
          .click();
        for (let i = 0; i < 8; i++)
          for (const key of ["required", "handling", "status"]) {
            const checkbox = d
              .locator('label[for="template-' + g + "-" + i + "-" + key + '"]')
              .getByRole("checkbox");
            if (
              (await checkbox.getAttribute("aria-checked")) !==
              String(combinations[i][key])
            )
              await checkbox.click();
          }
      }
      await d
        .getByRole("button", { name: "Lưu biểu mẫu", exact: true })
        .click();
      await d.waitFor({ state: "hidden" });
      const stored = await api(admin, "/template_form/" + r.typeId);
      for (const g of stored.forms)
        for (let i = 0; i < 8; i++)
          for (const key of ["required", "handling", "status"])
            assert.equal(g.children[i][key], combinations[i][key]);
      r.forms = stored.forms;
      save();
      await p
        .getByRole("button", { name: "Biểu mẫu " + r.prefix, exact: true })
        .click();
      d = p.getByRole("dialog").last();
      for (let g = 0; g < 2; g++) {
        await d
          .getByRole("button", { name: "Mở rộng phần " + (g + 1), exact: true })
          .click();
        for (let i = 0; i < 8; i++)
          for (const key of ["required", "handling", "status"])
            assert.equal(
              await d
                .locator(
                  'label[for="template-' + g + "-" + i + "-" + key + '"]',
                )
                .getByRole("checkbox")
                .getAttribute("aria-checked"),
              String(combinations[i][key]),
            );
      }
      await p.keyboard.press("Escape");
      record("configure-and-reopen-all-8-switch-combinations", {
        typeId: r.typeId,
        fields: 16,
        checkboxesVerified: 48,
      });
    }
    let life = r.tickets.find((t) => t.title.endsWith(" LIFECYCLE"))?.id;
    if (!life) {
      const p = await pageFor(creator);
      await p.goto(base + "/requests/new");
      await p.locator("#create-handling_group").waitFor();
      await p.evaluate(
        async ({ typeId, prefix }) => {
          const d =
              await import("/src/features/requests/utils/request-create-draft.ts"),
            u =
              await import("/src/features/requests/utils/request-detail-data.ts"),
            a = await import("/src/features/settings/api/template-api.ts");
          const groups = u.getCreateRequestGroups(
            (await a.getRequestTemplate(typeId)).forms,
          );
          d.writeRequestDraft(
            d.requestDraftKey(811, null),
            d.createDraft(
              {
                handling_group: "24",
                ticket_type: String(typeId),
                approve_user: "816",
                fore_cus: "2",
                bophansudung: "31",
                other1: ["89"],
                vanphong: "8",
                title: prefix + " LIFECYCLE",
                description: "All 8 configurations, two detail rows",
                duedate: "25/11/2026",
                rows: [u.emptyDetailRow(groups), u.emptyDetailRow(groups)],
              },
              [],
              crypto.randomUUID(),
            ),
          );
        },
        { typeId: r.typeId, prefix: r.prefix },
      );
      await p.goto(base + "/requests/new");
      await p.locator("#detail-0-f0").waitFor();
      assert.equal(await p.locator("#detail-0-f8").count(), 0);
      for (let row = 0; row < 2; row++)
        for (let i = 0; i < 8; i++)
          assert.equal(
            await p.locator("#detail-" + row + "-f" + i).isDisabled(),
            false,
          );
      const before = r.writes.length;
      await p.getByRole("button", { name: "Tạo yêu cầu", exact: true }).click();
      await p
        .getByText("Vui lòng nhập Create R1H0S0.", { exact: true })
        .first()
        .waitFor();
      assert.equal(r.writes.length, before);
      for (let row = 0; row < 2; row++)
        for (let i = 4; i < 8; i++)
          await p
            .locator("#detail-" + row + "-f" + i)
            .fill(r.prefix + " CREATE " + row + " " + i);
      await p.getByRole("button", { name: "Tạo yêu cầu", exact: true }).click();
      await p.waitForURL(/\/requests(?:\/\d+)?$/);
      life = r.tickets.find((t) => t.title.endsWith(" LIFECYCLE")).id;
      record("create-two-rows-all-8-required-and-change-combinations", {
        ticketId: life,
        requiredValidated: 8,
        lockedCreateFieldsRemainEnterable: 8,
        optionalBlankAccepted: true,
      });
    }
    if (!has("create-two-rows-all-8-required-and-change-combinations")) {
      const t = await get(life);
      assert.equal(t.data_item.dataform.data.length, 2);
      for (let row = 0; row < 2; row++)
        for (let i = 0; i < 8; i++)
          assert.equal(
            t.data_item.dataform.data[row]["Create " + combinations[i].name],
            i < 4 ? "" : r.prefix + " CREATE " + row + " " + i,
          );
      record("create-two-rows-all-8-required-and-change-combinations", {
        ticketId: life,
        requiredValidated: 8,
        optionalBlankAccepted: true,
        rowsReadBack: 2,
      });
    }
    r.life = life;
    save();
    const roles = async (name, user, buttons, privateVisible) => {
      if (has(name)) return;
      const p = await goto(user, life);
      assert.equal(
        await p.getByRole("button", { name: "Chỉnh sửa", exact: true }).count(),
        buttons,
      );
      for (const g of ["Create ", "Process "])
        for (const c of combinations)
          assert.equal(
            await p
              .getByRole("button", { name: g + c.name, exact: true })
              .count(),
            !c.status || privateVisible ? 1 : 0,
          );
      record(name, { actor: user, editButtons: buttons, privateVisible });
    };
    await roles("new-ticket-creator-visibility", creator, 0, true);
    await roles("new-ticket-unassigned-handler-visibility", handler, 0, false);
    await action("approve", approver, life, "Phê duyệt", 2);
    await roles("approved-unreceived-handler-cannot-edit", handler, 0, false);
    await action("receive", handler, life, "Tiếp nhận", 3);
    if (!has("processing-all-8-combinations-validate-save-reload")) {
      const p = await goto(handler, life),
        t = await get(life);
      r.processingHeader = t.data_item.dataform.header[1];
      save();
      assert.equal(
        await p.getByRole("button", { name: "Chỉnh sửa", exact: true }).count(),
        1,
        "Active handler must edit processing section even with legacy field.editable=true",
      );
      await p.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
      for (let row = 0; row < 2; row++)
        for (let i = 0; i < 8; i++)
          assert.equal(
            await p.locator("#detail-" + row + "-f" + (8 + i)).isDisabled(),
            !combinations[i].handling,
          );
      const before = r.writes.length;
      await p
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await p
        .getByText("Vui lòng nhập Process R1H1S0.", { exact: true })
        .first()
        .waitFor();
      assert.equal(r.writes.length, before);
      for (let row = 0; row < 2; row++)
        for (const i of [6, 7])
          await p
            .locator("#detail-" + row + "-f" + (8 + i))
            .fill(r.prefix + " REQUIRED " + row + " " + i);
      await p
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await p.getByRole("button", { name: "Chỉnh sửa", exact: true }).waitFor();
      let saved = await get(life);
      for (let row = 0; row < 2; row++)
        for (let i = 0; i < 8; i++)
          assert.equal(
            saved.data_item.dataform.data[row][
              "Process " + combinations[i].name
            ],
            i >= 6 ? r.prefix + " REQUIRED " + row + " " + i : "",
          );
      await p.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
      for (let row = 0; row < 2; row++)
        for (const i of [2, 3, 6, 7])
          await p
            .locator("#detail-" + row + "-f" + (8 + i))
            .fill(r.prefix + " UPDATED " + row + " " + i);
      await p
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await p.getByRole("button", { name: "Chỉnh sửa", exact: true }).waitFor();
      saved = await get(life);
      for (let row = 0; row < 2; row++)
        for (let i = 0; i < 8; i++)
          assert.equal(
            saved.data_item.dataform.data[row][
              "Process " + combinations[i].name
            ],
            combinations[i].handling
              ? r.prefix + " UPDATED " + row + " " + i
              : "",
          );
      record("processing-all-8-combinations-validate-save-reload", {
        ticketId: life,
        rows: 2,
        lockedRequiredFieldsExcluded: true,
        optionalBlankAccepted: true,
        legacyEditableTrueAccepted: true,
      });
    }
    await roles("active-handler-visibility", handler, 1, true);
    await roles(
      "unassigned-staff-cannot-edit-or-view-private",
      other,
      0,
      false,
    );
    await roles("creator-visibility-after-processing", creator, 1, true);
    await action("complete", handler, life, "Hoàn thành", 5);
    await roles(
      "completed-handler-read-only-with-history-access",
      handler,
      0,
      true,
    );
    await action(
      "reopen",
      creator,
      life,
      "Xử lý lại",
      6,
      r.prefix + " reopen all combinations",
    );
    await roles("reopen-before-receive-read-only", handler, 0, true);
    await action("receive-reopened", handler, life, "Tiếp nhận", 3);
    if (!has("reopened-handler-updates-optional-field")) {
      const p = await goto(handler, life);
      await p.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
      await p.locator("#detail-0-f10").fill(r.prefix + " REOPENED");
      await p
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await p.getByRole("button", { name: "Chỉnh sửa", exact: true }).waitFor();
      assert.equal(
        (await get(life)).data_item.dataform.data[0]["Process R0H1S0"],
        r.prefix + " REOPENED",
      );
      record("reopened-handler-updates-optional-field");
    }
    await action("complete-reopened", handler, life, "Hoàn thành", 5);
    await action("close", creator, life, "Đóng", 7);
    await roles("closed-ticket-creator-read-only", creator, 0, true);
    if (!has("clone-creator-and-unrelated-reader-privacy-all-8")) {
      for (const user of [creator, approver]) {
        const p = await pageFor(user);
        await p.goto(base + "/requests/new?clone=" + life);
        await p.locator("#detail-0-f0").waitFor();
        for (let row = 0; row < 2; row++)
          for (let i = 0; i < 8; i++) {
            const expected =
              i < 4 || (user !== creator && combinations[i].status)
                ? ""
                : r.prefix + " CREATE " + row + " " + i;
            assert.equal(
              await p.locator("#detail-" + row + "-f" + i).inputValue(),
              expected,
            );
          }
        assert.equal(await p.locator("#detail-0-f8").count(), 0);
      }
      record("clone-creator-and-unrelated-reader-privacy-all-8", {
        source: life,
        actors: [creator, approver],
      });
    }
    if (!has("clone-create-review-ticket")) {
      const existing = r.tickets.find((t) => t.title.endsWith(" REVIEW"));
      if (!existing) {
        const p = await pageFor(creator);
        await p.goto(base + "/requests/new?clone=" + life);
        await p.locator("#detail-0-f0").waitFor();
        await p.locator("#create-title").fill(r.prefix + " REVIEW");
        await p
          .getByRole("button", { name: "Tạo yêu cầu", exact: true })
          .click();
        await p.waitForURL(/\/requests(?:\/\d+)?$/);
      }
      r.reviewTicket = r.tickets.find((t) => t.title.endsWith(" REVIEW")).id;
      save();
      const t = await get(r.reviewTicket);
      assert.equal(t.ticket_status, 1);
      assert.equal(t.data_item.dataform.data.length, 2);
      for (const row of t.data_item.dataform.data)
        for (const c of combinations)
          assert.equal(row["Process " + c.name], "");
      record("clone-create-review-ticket", {
        ticketId: r.reviewTicket,
        processingValuesNotCopied: true,
      });
    }
    await action("review-approve", approver, r.reviewTicket, "Phê duyệt", 2);
    await action("review-receive", handler, r.reviewTicket, "Tiếp nhận", 3);
    if (!has("review-all-8-processing-switches-left-open")) {
      const p = await goto(handler, r.reviewTicket);
      assert.equal(
        await p.getByRole("button", { name: "Chỉnh sửa", exact: true }).count(),
        1,
      );
      await p.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
      for (let row = 0; row < 2; row++)
        for (let i = 0; i < 8; i++)
          assert.equal(
            await p.locator("#detail-" + row + "-f" + (8 + i)).isDisabled(),
            !combinations[i].handling,
          );
      await p.getByTitle("Hủy chỉnh sửa", { exact: true }).click();
      record("review-all-8-processing-switches-left-open", {
        ticketId: r.reviewTicket,
        url: ticketTestEnv.baseUrl + "/requests/" + r.reviewTicket,
      });
    }
    if (!has("new-field-untouched-checkboxes-save-as-false")) {
      const p = await pageFor(admin),
        stored = await api(admin, "/template_form/" + r.typeId);
      if (
        !stored.forms[1].children.some(
          (f) => f.title === "Unchecked default TEST",
        )
      ) {
        await p.goto(
          base +
            "/settings/request-types?search=" +
            encodeURIComponent(r.prefix),
        );
        await p
          .getByRole("button", { name: "Biểu mẫu " + r.prefix, exact: true })
          .click();
        const d = p.getByRole("dialog").last();
        await d
          .getByRole("button", { name: "Mở rộng phần 2", exact: true })
          .click();
        const section = d.getByRole("region", { name: "Phần 2", exact: true });
        await section
          .getByRole("button", { name: "Thêm trường", exact: true })
          .click();
        await section
          .getByLabel("Tên trường", { exact: false })
          .last()
          .fill("Unchecked default TEST");
        for (const key of ["required", "handling", "status"])
          assert.equal(
            await d
              .locator('label[for="template-1-8-' + key + '"]')
              .getByRole("checkbox")
              .getAttribute("aria-checked"),
            "false",
          );
        await d
          .getByRole("button", { name: "Lưu biểu mẫu", exact: true })
          .click();
        await d.waitFor({ state: "hidden" });
      }
      const actual = await api(admin, "/template_form/" + r.typeId),
        field = actual.forms[1].children.find(
          (f) => f.title === "Unchecked default TEST",
        );
      for (const key of ["required", "handling", "status"])
        assert.equal(field[key], false);
      for (const group of actual.forms)
        for (let i = 0; i < 8; i++)
          for (const key of ["required", "handling", "status"])
            assert.equal(group.children[i][key], combinations[i][key]);
      r.savedForms = actual.forms;
      record("new-field-untouched-checkboxes-save-as-false", {
        typeId: r.typeId,
        field: field.title,
        required: field.required,
        handling: field.handling,
        private: field.status,
        originalCombinationsPreserved: true,
      });
    }
    const final = await get(life);
    r.history = await api(admin, "/list_ticket_history/?ticket_id=" + life);
    assert.equal(final.ticket_status, 7);
    assert(r.history.length > 10);
    r.finalStatus = final.ticket_status;
    r.matrix = combinations;
    assert.equal(r.runtimeErrors.length, 0);
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
