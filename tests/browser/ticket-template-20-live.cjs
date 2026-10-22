const ticketTestEnv = require("../env.cjs");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
// Credentials map {username:password} arrives on stdin. Keep the working report outside Vite's watched tree.
const statePath =
    process.env.TEMPLATE_REPORT || "/tmp/ticket-template-20-live-state.json",
  apiBase = ticketTestEnv.apiUrl,
  base = ticketTestEnv.baseUrl;
const report = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
  : {
      prefix:
        "TEST_FORM20_261022_" + Date.now().toString(36).slice(-6).toUpperCase(),
      startedAt: new Date().toISOString(),
      cases: [],
      writes: [],
      tickets: [],
      runtimeErrors: [],
      initialFailures: [],
      status: "running",
    };
const save = () =>
  fs.writeFileSync(statePath, JSON.stringify(report, null, 2) + "\n");
const record = (id, name, details = {}) => {
  const entry = { id, name, status: "passed", ...details },
    idx = report.cases.findIndex((x) => x.id === id);
  if (idx < 0) report.cases.push(entry);
  else report.cases[idx] = entry;
  save();
  console.log(JSON.stringify({ id, name, status: entry.status }));
};
const field = (title, type = "text", extra = {}) => ({
  title,
  type,
  required: true,
  handling: true,
  status: false,
  editable: true,
  ...extra,
});
const forms = [
  {
    title: "Thông tin tạo TEST",
    editable: true,
    children: [
      field("Nội dung công khai", "text", { widthcol: 260 }),
      field("Nội dung riêng", "text", { status: true, widthcol: 280 }),
      field("Không bắt buộc", "text", { required: false }),
      field("Số lượng", "number"),
      field("Lựa chọn", "text", { option: ["Hà Nội", "Đà Nẵng", "日本語"] }),
      field("Ngày gốc", "date-text"),
      ...[
        [">", "Ngày lớn hơn"],
        [">=", "Ngày lớn hoặc bằng"],
        ["<", "Ngày nhỏ hơn"],
        ["<=", "Ngày nhỏ hoặc bằng"],
      ].map(([operator, title]) =>
        field(title, "date-text", {
          validate: { operator, target: "Ngày gốc" },
        }),
      ),
      field("Khoảng thời gian", "range-date-text", { widthcol: 460 }),
      field("Ca làm", "range-date-text", {
        required: false,
        option: ["Sáng", "Chiều"],
      }),
      field("Số tùy chọn", "number", { required: false }),
    ],
  },
  {
    title: "Xử lý TEST",
    editable: false,
    children: [
      field("Kết quả công khai", "text", { editable: false }),
      field("Ghi chú nội bộ", "text", { editable: false, status: true }),
      field("Khóa thay đổi", "text", { editable: false, handling: false }),
      field("Người tạo bổ sung", "text", { editable: true }),
    ],
  },
  {
    title: "Phần riêng TEST",
    editable: false,
    children: [
      field("Riêng hoàn toàn", "text", { editable: false, status: true }),
    ],
  },
];
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8")),
    auth = {};
  for (const [user, password] of Object.entries(credentials)) {
    const response = await fetch(apiBase + "/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password }),
    });
    if (!response.ok) throw Error("Login " + user + " " + response.status);
    auth[user] = await response.json();
  }
  const api = async (user, path, body, method = "POST") => {
    const write = body !== undefined;
    if (write) {
      let allowed = false;
      if (path === "/tickettypemmanager/")
        allowed =
          body instanceof FormData &&
          body.get("name") === report.prefix &&
          body.get("handling_group") === "22";
      if (path === "/template_form/")
        allowed =
          body.ticket_type === report.typeId &&
          body.data_form.forms[0].title.endsWith("TEST");
      if (path === "/ticket_manager")
        allowed =
          body.title.startsWith(report.prefix) &&
          body.ticket_type === report.typeId;
      if (
        ["/accept_ticket/", "/receive_ticket/", "/edit_item_data/"].includes(
          path,
        )
      )
        allowed = report.tickets.some((t) => t.id === body.ticket_id);
      if (!allowed) throw Error("Write outside test scope " + path);
    }
    const response = await fetch(apiBase + path, {
      method: write ? method : "GET",
      headers: {
        Authorization: "Bearer " + auth[user].access,
        ...(write && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(write
        ? { body: body instanceof FormData ? body : JSON.stringify(body) }
        : {}),
    });
    const data = await response.json();
    if (write) {
      report.writes.push({ path, method, status: response.status });
      save();
    }
    if (!response.ok)
      throw Error(path + " " + response.status + " " + JSON.stringify(data));
    return data;
  };
  const admin = "admin",
    creator = "test_p261021_all",
    reader =
      report.readerAccount?.username ||
      process.env.TEMPLATE_READER ||
      Object.keys(credentials).find((user) =>
        user.startsWith("test_form20_reader_"),
      ),
    cloneReader = reader;
  if (!report.typeId) {
    const body = new FormData();
    body.set("name", report.prefix);
    body.set("handling_group", "22");
    body.set("is_active", "true");
    const type = await api(admin, "/tickettypemmanager/", body);
    assert(type.id);
    report.typeId = type.id;
    save();
  }
  if (!report.templateSaved) {
    await api(admin, "/template_form/", {
      ticket_type: report.typeId,
      data_form: { forms },
      user: 334,
      mota: report.prefix,
      ghichu: "20 live configuration cases",
    });
    report.templateSaved = true;
    save();
  }
  const actual = await api(admin, "/template_form/" + report.typeId);
  report.forms = actual.forms;
  save();
  for (let i = 0; i < forms.length; i++) {
    assert.equal(actual.forms[i].title, forms[i].title);
    for (let j = 0; j < forms[i].children.length; j++)
      for (const [key, value] of Object.entries(forms[i].children[j]))
        assert.deepEqual(
          actual.forms[i].children[j][key],
          value,
          "template " + i + "/" + j + "/" + key,
        );
  }
  record(1, "Lưu và đọc lại toàn bộ cấu hình biểu mẫu thật", {
    typeId: report.typeId,
    groups: actual.forms.length,
    fields: actual.forms.flatMap((g) => g.children).length,
    settings: [
      "required",
      "handling",
      "status",
      "editable",
      "type",
      "option",
      "widthcol",
      "validate",
      "order",
    ],
    method: "real-api-write-readback",
  });
  if (process.argv[2] === "setup") return;
  assert(
    reader,
    "Provide a separate TEST reader with can_view/can_create/can_allticket and is_handling=false",
  );
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const pages = {},
    contexts = [];
  const pageFor = async (user) => {
    if (pages[user]) return pages[user];
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "Asia/Ho_Chi_Minh",
    });
    contexts.push(context);
    await context.addCookies([
      { name: "_access_token_ticket", value: auth[user].access, url: base },
      { name: "_refresh_token_ticket", value: auth[user].refresh, url: base },
    ]);
    await context.route("**/api/**", (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (request.method() === "GET" || path === "/api/token/refresh/")
        return route.continue();
      let allowed = false;
      if (path === "/api/ticket_manager") {
        const b = request.postDataJSON();
        allowed =
          b.title.startsWith(report.prefix) && b.ticket_type === report.typeId;
      }
      if (
        path === "/api/template_form/" + report.typeId &&
        request.method() === "PUT"
      )
        allowed = user === "admin";
      if (
        [
          "/api/edit_item_data/",
          "/api/accept_ticket/",
          "/api/receive_ticket/",
        ].includes(path)
      ) {
        const b = request.postDataJSON();
        allowed = report.tickets.some((t) => t.id === b.ticket_id);
      }
      if (!allowed) {
        report.blocked = report.blocked ?? [];
        report.blocked.push({ path, method: request.method() });
        save();
        return route.abort();
      }
      return route.continue();
    });
    const p = await context.newPage();
    p.setDefaultTimeout(30000);
    p.on("pageerror", (e) => {
      report.runtimeErrors.push(e.message);
      save();
    });
    pages[user] = p;
    if (user === reader) {
      await p.goto(base + "/requests");
      await p.locator("main").waitFor();
    } else {
      await p.goto(base + "/requests/new");
      await p.locator("#create-handling_group").waitFor();
    }
    return p;
  };
  try {
    const p = await pageFor(creator);
    const values = await p.evaluate(
      async ({ prefix, typeId }) => {
        const { getRequestTemplate } =
          await import("/src/features/settings/api/template-api.ts");
        const utils =
          await import("/src/features/requests/utils/request-detail-data.ts");
        const groups = utils.getCreateRequestGroups(
            (await getRequestTemplate(typeId)).forms,
          ),
          row = utils.emptyDetailRow(groups);
        Object.assign(row.values, {
          f0: prefix + " Unicode tiếng Việt 日本語 ✅",
          f1: prefix + " SECRET",
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
        return {
          handling_group: "22",
          ticket_type: String(typeId),
          approve_user: "804",
          fore_cus: "2",
          bophansudung: "31",
          other1: ["89"],
          vanphong: "8",
          title: prefix + " real ticket",
          description: "TEST cấu hình",
          duedate: "25/11/2026",
          rows: [row],
        };
      },
      { prefix: report.prefix, typeId: report.typeId },
    );
    const seed = async (page, userId, v) => {
      await page.evaluate(
        async ({ userId, v }) => {
          const d =
            await import("/src/features/requests/utils/request-create-draft.ts");
          d.writeRequestDraft(
            d.requestDraftKey(userId, null),
            d.createDraft(v, [], crypto.randomUUID()),
          );
        },
        { userId, v },
      );
      await page.goto(base + "/requests/new");
      await page.locator("#detail-0-f0").waitFor();
    };
    await seed(p, 811, values);
    assert.equal(await p.locator("#detail-0-f13").count(), 0);
    assert.equal(
      await p.getByText("Kết quả công khai", { exact: true }).count(),
      0,
    );
    record(2, "Chỉ phần hiển thị khi tạo xuất hiện trong form tạo", {
      method: "browser-ui-real-template",
    });
    const validation = await p.evaluate(
      async ({ typeId, values }) => {
        const { getRequestTemplate } =
          await import("/src/features/settings/api/template-api.ts");
        const { getCreateRequestSchema } =
          await import("/src/features/requests/schemas/create-request-schema.ts");
        const { getCreateRequestGroups } =
          await import("/src/features/requests/utils/request-detail-data.ts");
        const schema = getCreateRequestSchema(
          getCreateRequestGroups((await getRequestTemplate(typeId)).forms),
        );
        const run = (patch) => {
          const v = structuredClone(values);
          Object.assign(v.rows[0].values, patch);
          const result = schema.safeParse(v);
          return {
            valid: result.success,
            issues: result.success
              ? []
              : result.error.issues.map((i) => ({
                  path: i.path.join("."),
                  message: i.message,
                })),
          };
        };
        return {
          baseline: run({}),
          required: [
            run({ f0: " " }),
            run({ f1: "" }),
            run({ f2: "", f12: "" }),
          ],
          number: [
            run({ f3: "abc" }),
            run({ f3: "Infinity" }),
            run({ f3: "0" }),
            run({ f3: "-1.5" }),
          ],
          choices: [
            run({ f4: "INVALID" }),
            run({ f4: "日本語", f11: "Chiều" }),
          ],
          date: [run({ f5: "31/02/2026" }), run({ f5: "" }), run({})],
          range: [
            run({ f10_end: "" }),
            run({ f10_start: "23/11/2026", f10_end: "22/11/2026" }),
            run({}),
          ],
          gt: [run({ f6: "20/11/2026" }), run({ f6: "21/11/2026" })],
          ge: [run({ f7: "19/11/2026" }), run({ f7: "20/11/2026" })],
          lt: [run({ f8: "20/11/2026" }), run({ f8: "19/11/2026" })],
          le: [run({ f9: "21/11/2026" }), run({ f9: "20/11/2026" })],
        };
      },
      { typeId: report.typeId, values },
    );
    assert(validation.baseline.valid, JSON.stringify(validation.baseline));
    for (const [id, key, name, expected] of [
      [3, "required", "Bắt buộc và không bắt buộc", [false, false, true]],
      [
        4,
        "number",
        "Số sai định dạng, vô hạn, số 0 và số thập phân âm",
        [false, false, true, true],
      ],
      [
        5,
        "choices",
        "Tùy chọn danh sách và khoảng ngày dạng lựa chọn",
        [false, true],
      ],
      [6, "date", "Ngày hợp lệ, sai lịch và bỏ trống", [false, false, true]],
      [
        7,
        "range",
        "Khoảng ngày thiếu đầu cuối và đảo thứ tự",
        [false, false, true],
      ],
      [8, "gt", "Điều kiện ngày >", [false, true]],
      [9, "ge", "Điều kiện ngày >=", [false, true]],
      [10, "lt", "Điều kiện ngày <", [false, true]],
      [11, "le", "Điều kiện ngày <=", [false, true]],
    ]) {
      assert.deepEqual(
        validation[key].map((x) => x.valid),
        expected,
        key,
      );
      record(id, name, {
        method: "application-validation-on-real-api-template",
        evidence: validation[key],
      });
    }
    if (!report.tickets.some((t) => t.creator === creator)) {
      const createdResponse = p.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/ticket_manager" &&
          r.request().method() === "POST",
      );
      await p.getByRole("button", { name: "Tạo yêu cầu", exact: true }).click();
      const response = await createdResponse;
      assert(response.ok());
      const t = await response.json();
      assert(t.id);
      report.tickets.push({ id: t.id, code: t.ticket_code, creator });
      save();
      await p.waitForURL("**/requests");
    }
    const id = report.tickets.find((t) => t.creator === creator).id;
    report.mainTicket = id;
    save();
    const saved = await api(creator, "/ticket_manager/" + id);
    assert(saved.title.startsWith(report.prefix));
    assert.equal(saved.data_item.dataform.data[0]["Số lượng"], "0");
    assert.equal(
      saved.data_item.dataform.data[0]["Nội dung riêng"],
      values.rows[0].values.f1,
    );
    assert(
      ["", report.prefix + " handled public"].includes(
        saved.data_item.dataform.data[0]["Kết quả công khai"],
      ),
    );
    record(12, "Tạo ticket bằng UI và đọc lại dữ liệu thật", {
      method: "browser-ui-create-real-api-readback",
      ticketId: id,
    });
    report.values = values;
    save();

    const runCase = async (caseId, name, fn) => {
      try {
        await fn();
        record(caseId, name, { method: "browser-ui-real-api-readback" });
      } catch (error) {
        const detail = {
          id: caseId,
          name,
          status: "failed",
          error: error.message,
        };
        const idx = report.cases.findIndex((c) => c.id === caseId);
        if (idx < 0) report.cases.push(detail);
        else report.cases[idx] = detail;
        if (!report.initialFailures.some((c) => c.id === caseId))
          report.initialFailures.push(detail);
        save();
        console.log(JSON.stringify(detail));
      }
    };
    const detail = async (page) => {
      await page.goto(base + "/requests/" + id + "?tab=details");
      await page
        .getByRole("heading", { name: "Thông tin tạo TEST", exact: true })
        .waitFor();
    };
    await runCase(
      13,
      "Người tạo xem trường công khai và riêng tư",
      async () => {
        await detail(p);
        assert.equal(
          await p
            .getByRole("button", { name: "Nội dung riêng", exact: true })
            .count(),
          1,
        );
        assert.equal(
          await p.getByText(values.rows[0].values.f1, { exact: true }).count(),
          1,
        );
        assert.equal(
          await p
            .getByRole("heading", { name: "Phần riêng TEST", exact: true })
            .count(),
          1,
        );
      },
    );
    const readerPage = await pageFor(reader);
    await runCase(
      14,
      "Người xem khác bị ẩn tên, giá trị và phần chỉ có trường riêng",
      async () => {
        await detail(readerPage);
        assert.equal(
          await readerPage
            .getByRole("button", { name: "Nội dung riêng", exact: true })
            .count(),
          0,
        );
        assert.equal(
          await readerPage
            .getByText(values.rows[0].values.f1, { exact: true })
            .count(),
          0,
        );
        assert.equal(
          await readerPage
            .getByRole("heading", { name: "Phần riêng TEST", exact: true })
            .count(),
          0,
        );
        assert.equal(
          await readerPage
            .getByText(values.rows[0].values.f0, { exact: true })
            .count(),
          1,
        );
        const readerData = await api(reader, "/ticket_manager/" + id);
        report.observations = {
          readerApiIncludesRestrictedData:
            readerData.data_item?.dataform.data[0]["Nội dung riêng"] ===
            values.rows[0].values.f1,
        };
        save();
      },
    );
    let state = await api(admin, "/ticket_manager/" + id);
    if (state.ticket_status === 1)
      await api("test_p261021_accept", "/accept_ticket/", { ticket_id: id });
    state = await api(admin, "/ticket_manager/" + id);
    if (state.ticket_status === 2)
      await api(admin, "/receive_ticket/", { ticket_id: id });
    const adminPage = await pageFor(admin);
    await runCase(15, "Người xử lý xem đầy đủ trường riêng tư", async () => {
      await detail(adminPage);
      assert.equal(
        await adminPage
          .getByRole("button", { name: "Nội dung riêng", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await adminPage
          .getByText(values.rows[0].values.f1, { exact: true })
          .count(),
        1,
      );
      assert.equal(
        await adminPage
          .getByRole("heading", { name: "Phần riêng TEST", exact: true })
          .count(),
        1,
      );
    });
    const processing = (page) =>
      page
        .getByRole("heading", { name: "Xử lý TEST", exact: true })
        .locator('xpath=ancestor::div[@data-slot="card"][1]');
    await runCase(
      16,
      "Cho phép thay đổi bật/tắt khi người xử lý cập nhật",
      async () => {
        await detail(adminPage);
        const section = processing(adminPage);
        await section
          .getByRole("button", { name: "Chỉnh sửa", exact: true })
          .click();
        try {
          assert.equal(
            await adminPage.locator("#detail-0-f13").isDisabled(),
            false,
          );
          assert.equal(
            await adminPage.locator("#detail-0-f15").isDisabled(),
            true,
            "Trường handling=false phải khóa",
          );
          assert.equal(
            await adminPage.locator("#detail-0-f16").isDisabled(),
            true,
          );
          await adminPage
            .locator("#detail-0-f13")
            .fill(report.prefix + " handled public");
          await adminPage
            .locator("#detail-0-f14")
            .fill(report.prefix + " handled secret");
          await section
            .getByRole("button", { name: "Lưu thay đổi", exact: true })
            .click();
          await section
            .getByRole("button", { name: "Chỉnh sửa", exact: true })
            .waitFor();
          const updated = await api(admin, "/ticket_manager/" + id);
          assert.equal(
            updated.data_item.dataform.data[0]["Kết quả công khai"],
            report.prefix + " handled public",
          );
          assert.equal(updated.data_item.dataform.data[0]["Khóa thay đổi"], "");
        } finally {
          const cancel = section.getByRole("button", {
            name: "Hủy",
            exact: true,
          });
          if (await cancel.count()) await cancel.click();
        }
      },
    );
    await runCase(
      17,
      "Người tạo chỉ sửa trường dành cho người tạo trong phần xử lý",
      async () => {
        await detail(p);
        const section = processing(p);
        await section
          .getByRole("button", { name: "Chỉnh sửa", exact: true })
          .click();
        assert.equal(await p.locator("#detail-0-f13").isDisabled(), true);
        assert.equal(await p.locator("#detail-0-f16").isDisabled(), false);
        await p
          .locator("#detail-0-f16")
          .fill(report.prefix + " creator updated");
        await section
          .getByRole("button", { name: "Lưu thay đổi", exact: true })
          .click();
        await section
          .getByRole("button", { name: "Chỉnh sửa", exact: true })
          .waitFor();
        assert.equal(
          (await api(creator, "/ticket_manager/" + id)).data_item.dataform
            .data[0]["Người tạo bổ sung"],
          report.prefix + " creator updated",
        );
      },
    );
    await runCase(
      18,
      "Thêm, sắp xếp, xóa phần/trường, cấu hình checkbox và độ rộng rồi lưu thật",
      async () => {
        await adminPage.goto(
          base +
            "/settings/request-types?search=" +
            encodeURIComponent(report.prefix),
        );
        await adminPage
          .getByRole("button", {
            name: "Biểu mẫu " + report.prefix,
            exact: true,
          })
          .click();
        const editor = adminPage.getByRole("form", {
          name: "Cấu hình biểu mẫu",
        });
        await editor.waitFor();
        const first = editor.getByRole("region", {
          name: "Phần 1",
          exact: true,
        });
        await first
          .getByRole("button", { name: "Mở rộng phần 1", exact: true })
          .click();
        const checks = first.getByRole("checkbox", {
          name: "Chỉ hiển thị cho người tạo và người xử lý",
          exact: true,
        });
        assert.equal(await checks.nth(0).getAttribute("aria-checked"), "false");
        assert.equal(await checks.nth(1).getAttribute("aria-checked"), "true");
        await first
          .getByText("Tùy chọn nâng cao", { exact: true })
          .first()
          .click();
        assert.equal(
          await first
            .getByLabel("Độ rộng cột (px)", { exact: true })
            .first()
            .inputValue(),
          "260",
        );
        await editor
          .getByRole("button", { name: "Thêm phần", exact: true })
          .click();
        let temp = editor.getByRole("region", { name: "Phần 4", exact: true });
        await temp
          .getByRole("button", { name: "Mở rộng phần 4", exact: true })
          .click();
        await temp
          .getByLabel("Tên phần", { exact: false })
          .fill("TEST temp section");
        await temp
          .getByRole("button", { name: "Thêm trường", exact: true })
          .click();
        await temp
          .getByLabel("Tên trường", { exact: false })
          .fill("TEST temp field");
        await temp
          .getByRole("button", { name: "Thêm trường", exact: true })
          .click();
        await temp
          .getByLabel("Tên trường", { exact: false })
          .nth(1)
          .fill("TEST temp second");
        await temp
          .getByRole("button", { name: "Đưa trường 2 lên", exact: true })
          .click();
        assert.equal(
          await temp
            .getByLabel("Tên trường", { exact: false })
            .first()
            .inputValue(),
          "TEST temp second",
        );
        await temp
          .getByRole("button", { name: "Xóa trường 1", exact: true })
          .click();
        assert.equal(
          await temp.getByLabel("Tên trường", { exact: false }).count(),
          1,
        );
        await temp
          .getByRole("button", { name: "Đưa phần 4 lên", exact: true })
          .click();
        temp = editor.getByRole("region", { name: "Phần 3", exact: true });
        assert.equal(
          await temp.getByLabel("Tên phần", { exact: false }).inputValue(),
          "TEST temp section",
        );
        await temp
          .getByRole("button", { name: "Đưa phần 3 xuống", exact: true })
          .click();
        temp = editor.getByRole("region", { name: "Phần 4", exact: true });
        await temp
          .getByRole("button", { name: "Xóa phần 4", exact: true })
          .click();
        await editor
          .getByRole("button", { name: "Lưu biểu mẫu", exact: true })
          .click();
        await editor.waitFor({ state: "hidden" });
        const readback = await api(admin, "/template_form/" + report.typeId);
        assert.equal(readback.forms.length, 3);
        assert.deepEqual(
          readback.forms.map((g) => g.title),
          forms.map((g) => g.title),
        );
        assert.equal(readback.forms[0].children[0].widthcol, 260);
        assert.equal(readback.forms[0].children[1].status, true);
      },
    );
    await runCase(
      19,
      "Clone của người tạo giữ nội dung riêng và bỏ phần xử lý",
      async () => {
        await p.goto(base + "/requests/new?clone=" + id);
        await p.locator("#detail-0-f1").waitFor();
        assert.equal(
          await p.locator("#detail-0-f1").inputValue(),
          values.rows[0].values.f1,
        );
        assert.equal(await p.locator("#detail-0-f3").inputValue(), "0");
        assert.equal(await p.locator("#detail-0-f13").count(), 0);
      },
    );
    await runCase(
      20,
      "Clone của người xem khác không sao chép nội dung riêng",
      async () => {
        const clonePage = await pageFor(cloneReader);
        await clonePage.goto(base + "/requests/new?clone=" + id);
        await clonePage.locator("#detail-0-f1").waitFor();
        assert.equal(await clonePage.locator("#detail-0-f1").inputValue(), "");
        assert.equal(
          await clonePage.locator("#detail-0-f0").inputValue(),
          values.rows[0].values.f0,
        );
        assert.equal(await clonePage.locator("#detail-0-f3").inputValue(), "0");
      },
    );
    report.status =
      report.cases.length === 20 &&
      report.cases.every((c) => c.status === "passed")
        ? "passed"
        : "failed";
    report.completedAt = new Date().toISOString();
    delete report.error;
    save();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  report.status = "failed";
  report.error = e.message;
  save();
  console.error(e.stack);
  process.exitCode = 1;
});
