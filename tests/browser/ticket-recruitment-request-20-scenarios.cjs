const assert = require("node:assert/strict");
const fs = require("node:fs");
module.exports = async (ctx) => {
  const {
    phase,
    page,
    report,
    save,
    check,
    waitPath,
    choose,
    createForm,
    login,
    credentials,
    base,
    prefix,
    clean,
  } = ctx;
  const limit = Number(process.env.QC_LIMIT || 20);
  const fields = report.template.forms
    .filter((x) => x.editable !== false)
    .flatMap((x) => x.children || []);
  const date = (offset) => {
    const d = new Date(Date.UTC(2026, 9, 21 + offset));
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  };
  function values(index, row = 0) {
    const key = `${prefix}_${String(index).padStart(2, "0")}`;
    return [
      `${key} Team ${row + 1}`,
      `${key} Vị trí ${row + 1}`,
      String([1, 2, 10, 99][(index + row - 1) % 4]),
      date(7 + index + row),
      index % 2 ? "TEST Văn phòng Hồ Chí Minh" : "TEST Remote – Hà Nội",
      index % 3 ? "TEST 15.000.000–25.000.000 VNĐ" : "TEST Thỏa thuận",
      fields[6].option[(index + row - 1) % fields[6].option.length],
      fields[7].option[(index + row - 1) % fields[7].option.length],
      `${key} Mô tả công việc ${row + 1}${index === 17 ? " TEST_chi_tiết".repeat(80) : ""}`,
      index === 1 ? "" : fields[9].option[(index + row - 1) % 2],
      index === 1 ? "" : "TEST 22–35",
      index === 1 ? "" : "TEST 2 năm kinh nghiệm",
      index === 1 ? "" : "TEST English B2; React; kiểm thử Unicode Đặng",
    ];
  }
  async function fillRow(index, content) {
    for (let col = 0; col < fields.length; col++) {
      const field = fields[col],
        target = page.locator(`#detail-${index}-f${col}`),
        value = content[col];
      if (field.option?.length) {
        if (!value) continue;
        await target.click();
        const search = page.getByRole("combobox", {
          name: "Tìm " + clean(field.title).toLowerCase(),
          exact: true,
        });
        if (await search.count()) await search.fill(value);
        await page.getByRole("option", { name: value, exact: true }).click();
      } else await target.fill(value);
    }
  }
  async function ticketDetail(p, row) {
    const pending = waitPath(p, `/api/ticket_manager/${row.ticketId}`);
    await p.goto(`${base}/requests/${row.ticketId}`);
    const response = await pending;
    assert(response.ok());
    await p
      .getByRole("tab", { name: "Thông tin chung", exact: true })
      .waitFor();
    return response.json();
  }
  async function list(p = page, params = {}) {
    const pending = waitPath(p, "/api/list_recruitment/");
    const query = new URLSearchParams({
      from_date: "2026-10-21",
      to_date: "2026-10-21",
      page_size: "100",
      title: prefix,
      ...params,
    });
    await p.goto(`${base}/recruitment/requests?${query}`);
    const response = await pending;
    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (response.ok())
      await p
        .locator(
          'section[aria-label="Danh sách yêu cầu tuyển dụng"][aria-busy="false"]',
        )
        .waitFor();
    return { response, data };
  }
  async function create() {
    for (let index = 1; index <= limit; index++) {
      if (report.records.some((x) => x.index === index)) continue;
      const template = await createForm(page);
      assert.equal(
        template.forms.flatMap((g) => g.children || []).length,
        fields.length,
      );
      const key = `${prefix}_${String(index).padStart(2, "0")}`;
      let title = `${key} Tuyển dụng TEST ${index}`;
      if (index === 19) title = title.padEnd(300, "Đ");
      await page.locator("#create-title").fill(title);
      const due = index === 14 ? date(0) : date(14 + index);
      await page.locator("#create-due-date").fill(due);
      const rowCount = index === 20 ? 5 : 1;
      const detailRows = [];
      if (index === 1) {
        const before = report.writes.length;
        await page
          .getByRole("button", { name: "Tạo yêu cầu", exact: true })
          .click();
        await page
          .getByText("Vui lòng nhập Team cần tuyển.", { exact: true })
          .waitFor();
        assert.equal(report.writes.length, before);
        check("create-missing-required-blocked", "passed");
      }
      for (let row = 0; row < rowCount; row++) {
        if (row > 0)
          await page
            .getByRole("button", { name: "Thêm dòng", exact: true })
            .click();
        const content = values(index, row);
        await fillRow(row, content);
        detailRows.push(content);
      }
      let description = `${key} QC yêu cầu tuyển dụng; dữ liệu TEST, không tuyển thật.`;
      if (index === 2) description = "";
      else if (index === 18) description = key.padEnd(1000, "N");
      await page.locator("#create-description").fill(description);
      assert.equal(await page.locator('[aria-invalid="true"]').count(), 0);
      const pending = waitPath(page, "/api/ticket_manager", "POST");
      await page
        .getByRole("button", { name: "Tạo yêu cầu", exact: true })
        .click();
      const response = await pending;
      const data = await response.json();
      if (!response.ok() || !data.id) {
        report.lastFailure = { phase, index, status: response.status(), data };
        save();
        throw Error(
          `Create ${index}: ${response.status()} ${JSON.stringify(data)}`,
        );
      }
      const payload = response.request().postDataJSON();
      assert.equal(payload.ticket_type, 99);
      assert.equal(payload.handling_group, 3);
      assert.equal(payload.formDataTicket.dataform.data.length, rowCount);
      const record = {
        index,
        key,
        title,
        ticketId: data.id,
        ticketCode: data.ticket_code || "",
        due,
        detailRows,
        payload,
        approved: false,
        recruitments: [],
      };
      report.records.push(record);
      save();
      await page.waitForURL((u) => u.pathname === "/requests");
      const detail = await ticketDetail(page, record);
      record.ticketCode = detail.ticket_code || record.ticketCode;
      record.initialStatus = detail.ticket_status;
      save();
      await page
        .getByRole("tab", { name: "Chi tiết yêu cầu", exact: true })
        .click();
      const panel = page.locator("#ticket-panel-1");
      await panel.getByRole("table").waitFor();
      assert.equal(await panel.locator("tbody tr").count(), rowCount);
      for (const value of detailRows.flat().filter(Boolean))
        await panel.getByText(value, { exact: true }).first().waitFor();
      check(`create-ticket-${index}`, "passed", {
        ticketId: record.ticketId,
        ticketCode: record.ticketCode,
        rows: rowCount,
        titleLength: title.length,
      });
    }
  }
  async function approve() {
    const approver = await login(credentials.approver);
    for (const row of report.records) {
      if (row.approved) continue;
      await ticketDetail(approver, row);
      const button = approver.getByRole("button", {
        name: "Phê duyệt",
        exact: true,
      });
      await button.click();
      const dialog = approver.getByRole("dialog");
      const pending = waitPath(approver, "/api/accept_ticket/", "POST");
      await dialog
        .getByRole("button", { name: "Phê duyệt", exact: true })
        .click();
      const response = await pending;
      const data = await response.json().catch(() => ({
        message: "Non-JSON response",
        status: response.status(),
      }));
      assert(response.ok(), JSON.stringify(data));
      await dialog.waitFor({ state: "hidden" });
      row.approved = true;
      save();
      const detail = await ticketDetail(approver, row);
      row.approvedStatus = detail.ticket_status;
      save();
      check(`approve-${row.index}`, "passed", {
        ticketId: row.ticketId,
        status: detail.ticket_status,
      });
    }
  }
  async function verify() {
    const { response, data } = await list();
    assert(response.ok(), JSON.stringify(data));
    report.recruitmentCount = data.count;
    save();
    for (const row of report.records) {
      const found = data.results.filter(
        (item) =>
          item.ticket_code === row.ticketCode || item.title === row.title,
      );
      row.recruitments = found;
      save();
      check(`generated-${row.index}`, found.length ? "passed" : "failed", {
        ticketId: row.ticketId,
        ticketCode: row.ticketCode,
        generatedCount: found.length,
      });
      if (!found.length) continue;
      for (const generated of found) {
        const pending = waitPath(
          page,
          `/api/detail_recruitment/${generated.id}`,
        );
        await page
          .getByRole("row")
          .filter({
            has: page.getByText(generated.rec_position, { exact: true }),
          })
          .getByRole("button", {
            name: `Xem yêu cầu ${row.ticketCode}`,
            exact: true,
          })
          .click();
        const response = await pending;
        const detail = (await response.json()).results;
        row.detailReadback = detail;
        row.detailsById ||= {};
        row.detailsById[generated.id] = detail;
        save();
        await page.locator("#recruitment-ticket_code").waitFor();
        assert.equal(
          await page.locator("#recruitment-ticket_code").inputValue(),
          row.ticketCode,
        );
        assert(await page.locator("#recruitment-ticket_code").isDisabled());
        assert(await page.locator("#recruitment-rec_position").isDisabled());
        const source = row.detailRows
          .find((values) => values[1] === detail.rec_position)
          ?.slice();
        if (source && row.edited?.[generated.id])
          source[2] = row.edited[generated.id].expected.quantity;
        const keys = [
          "team_recruited",
          "rec_position",
          "quantity",
          "time_start_work",
          "work_location",
          "salary_level",
          "education_level",
          "form_work",
          "job_description",
          "gender",
          "age",
          "experience",
          "other_skill",
        ];
        const mismatches = keys.flatMap((key, index) =>
          String(detail[key] ?? "") === String(source?.[index] ?? "")
            ? []
            : [{ key, expected: source?.[index], actual: detail[key] }],
        );
        check(
          `detail-${row.index}-${generated.id}`,
          mismatches.length ? "failed" : "passed",
          { id: generated.id, mismatches, verifiedFields: keys.length },
        );
        await page
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
      }
    }
  }
  async function legacy() {
    const pending = waitPath(page, "/api/ticket_manager/14092");
    await page.goto(base + "/requests/14092");
    const data = await (await pending).json();
    const form = data.data_item?.dataform;
    report.legacyKeys = form?.data?.map((row) => Object.keys(row));
    report.legacyHeaders = form?.header?.flatMap((g) =>
      g.children.map((f) => ({ title: f.title, dataIndex: f.dataIndex })),
    );
    save();
    check("approved-legacy-keys-read-only", "observed", {
      keys: report.legacyKeys,
      header: report.legacyHeaders,
    });
  }
  async function diagnose() {
    for (const row of report.records) {
      const detail = await ticketDetail(page, row);
      row.diagnostic = {
        status: detail.ticket_status,
        buttons: await page
          .getByRole("group", { name: "Thao tác yêu cầu", exact: true })
          .getByRole("button")
          .allTextContents(),
      };
      save();
      check(`diagnose-ticket-${row.index}`, "observed", row.diagnostic);
    }
    const result = await list();
    check("diagnose-recruitment-list", "observed", {
      status: result.response.status(),
      count: result.data.count,
      rows: result.data.results,
    });
  }
  async function discardFailed() {
    const row = report.records.find((x) => x.ticketId === 14445);
    if (!row) return;
    assert(!row.approved);
    await ticketDetail(page, row);
    await page.getByRole("button", { name: "Hủy", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox")
      .first()
      .fill(
        prefix + " Hủy bản TEST lỗi tương thích khóa dữ liệu; tạo lại sau sửa.",
      );
    const pending = waitPath(page, "/api/cancel_ticket/", "POST");
    await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
    const response = await pending;
    assert(response.ok());
    await dialog.waitFor({ state: "hidden" });
    report.failedTickets ||= [];
    report.failedTickets.push({
      ...row,
      cancelled: true,
      reason: "Approval backend requires legacy (*) field keys",
    });
    report.records = report.records.filter((x) => x.ticketId !== row.ticketId);
    save();
    check("failed-fixture-cancelled", "passed", { ticketId: row.ticketId });
  }
  async function openRecruitment(row, generated) {
    await list();
    const pending = waitPath(page, `/api/detail_recruitment/${generated.id}`);
    await page
      .getByRole("row")
      .filter({ has: page.getByText(generated.rec_position, { exact: true }) })
      .getByRole("button", {
        name: `Xem yêu cầu ${row.ticketCode}`,
        exact: true,
      })
      .click();
    const data = await (await pending).json();
    await page.locator("#recruitment-quantity").waitFor();
    return data;
  }
  async function submitRecruitment(generated) {
    const pending = waitPath(
      page,
      `/api/detail_recruitment/${generated.id}`,
      "PUT",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Lưu", exact: true })
      .click();
    const response = await pending;
    const data = await response.json().catch(() => ({}));
    if (!response.ok()) {
      report.lastFailure = {
        phase,
        id: generated.id,
        status: response.status(),
        data,
      };
      save();
      throw Error(
        `Recruitment update ${generated.id}: ${response.status()} ${JSON.stringify(data)}`,
      );
    }
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    return response;
  }
  async function edit() {
    for (const row of report.records.slice(0, limit))
      for (const generated of row.recruitments) {
        if (row.edited?.[generated.id]?.mismatches.length === 0) continue;
        const data = await openRecruitment(row, generated);
        const original = data.results;
        const wantedDate = original.duedate
          .slice(0, 10)
          .split("-")
          .reverse()
          .join("/");
        assert.equal(
          await page.locator("#recruitment-duedate").inputValue(),
          wantedDate,
        );
        assert(await page.locator("#recruitment-other_skill").isDisabled());
        assert.equal(
          await page.locator("#recruitment-other_skill").inputValue(),
          original.other_skill || "",
        );
        const forbidden =
          row.index <= 4 ? ["0", "-1", "1.5", "1e2"][row.index - 1] : null;
        if (forbidden) {
          const before = report.writes.length;
          await page.locator("#recruitment-quantity").fill(forbidden);
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Lưu", exact: true })
            .click();
          await page
            .getByText("Số lượng phải là số nguyên dương.", { exact: true })
            .waitFor();
          assert.equal(report.writes.length, before);
          check(`invalid-request-quantity-${row.index}`, "passed", {
            value: forbidden,
          });
        }
        const expected = {
          quantity: String(row.index + 1),
          user_new_quits: row.index % 3 ? `${row.key} Nhân viên TEST` : "",
          language_skill: row.index === 2 ? "" : "TEST English B2",
          computer_skill: row.index === 3 ? "" : "TEST Excel, SQL",
          note:
            row.index === 4
              ? ""
              : `${row.key} Chỉnh sửa qua giao diện ${row.index === 17 ? "TEST_ghi_chú_dài_".repeat(50) : ""}`.trim(),
        };
        for (const [key, value] of Object.entries(expected))
          await page.locator(`#recruitment-${key}`).fill(value);
        const reasons = data.list_reason_recruitment || [];
        if (reasons.length) {
          const reason = reasons[(row.index - 1) % reasons.length];
          await choose(page, "Lý do tuyển", reason.name);
          expected.reason_recr_id = reason.id;
        }
        if (row.index === 5) {
          await page.locator("#recruitment-file_upload").setInputFiles({
            name: `${row.key}_JD.txt`,
            mimeType: "text/plain",
            buffer: Buffer.from(`${row.key} Job description TEST file`),
          });
        }
        await submitRecruitment(generated);
        const updated = (await openRecruitment(row, generated)).results;
        const mismatches = Object.entries(expected).flatMap(([key, value]) =>
          String(updated[key] ?? "") === String(value)
            ? []
            : [{ key, expected: value, actual: updated[key] }],
        );
        for (const key of [
          "ticket_code",
          "title",
          "rec_position",
          "duedate",
          "department_recruited",
          "work_location",
          "job_description",
          "experience",
          "other_skill",
        ])
          if (String(original[key] ?? "") !== String(updated[key] ?? ""))
            mismatches.push({
              key,
              expected: original[key],
              actual: updated[key],
            });
        assert.equal(
          await page.locator("#recruitment-duedate").inputValue(),
          wantedDate,
        );
        if (row.index === 5) {
          assert.equal(updated.name_file_recr, `${row.key}_JD.txt`);
          row.upload = {
            name: updated.name_file_recr,
            path: updated.path_file_recr,
          };
        }
        row.edited ||= {};
        row.edited[generated.id] = { expected, readback: updated, mismatches };
        save();
        check(
          `edit-request-${row.index}-${generated.id}`,
          mismatches.length ? "failed" : "passed",
          { recordId: generated.id, mismatches },
        );
        await page
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
      }
  }
  async function filters() {
    let result = await list();
    assert(result.response.ok());
    const count = result.data.count;
    check("request-list-created-day-count", "passed", {
      tickets: report.records.length,
      requests: count,
    });
    const getListAfter = async (action) => {
      const pending = waitPath(page, "/api/list_recruitment/");
      await action();
      const response = await pending;
      return { response, data: await response.json() };
    };
    await choose(page, "Trạng thái yêu cầu", "Đã phê duyệt");
    result = await getListAfter(() =>
      page.getByRole("button", { name: "Tìm kiếm", exact: true }).click(),
    );
    assert.equal(result.data.count, count);
    check("request-status-approved-filter", "passed", { count });
    await list();
    await page
      .getByRole("button", { name: "Lọc nâng cao", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Bộ phận tuyển dụng", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "TEST_20261020_G3CCBK Dept OK",
        exact: true,
      })
      .click();
    await page.keyboard.press("Escape");
    result = await getListAfter(() =>
      page.getByRole("button", { name: "Áp dụng bộ lọc", exact: true }).click(),
    );
    assert.equal(result.data.count, count);
    check("request-department-filter", "passed", { count });
    await page
      .getByRole("button", { name: "Lọc nâng cao", exact: true })
      .click();
    result = await getListAfter(() =>
      page
        .getByRole("button", { name: "Xóa bộ lọc nâng cao", exact: true })
        .click(),
    );
    assert.equal(result.data.count, count);
    assert.equal(new URL(page.url()).searchParams.get("title"), prefix);
    check("request-clear-advanced-keeps-title", "passed");
    await list();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Xuất Excel", exact: true }).click();
    const file = await pending;
    assert.equal(await file.failure(), null);
    const bytes = fs.statSync(await file.path()).size;
    assert(bytes > 0);
    check("request-export-real-20", "passed", {
      bytes,
      filename: file.suggestedFilename(),
    });
    const first = report.records[0];
    await list(page, { title: first.title });
    await page
      .getByRole("link", { name: first.ticketCode, exact: true })
      .click();
    await page
      .getByRole("tab", { name: "Thông tin chung", exact: true })
      .waitFor();
    assert(new URL(page.url()).pathname.endsWith(String(first.ticketId)));
    check("request-ticket-source-link", "passed");
  }
  async function presentation() {
    const row = report.records.find((x) => x.index === 17),
      generated = row.recruitments[0];
    await openRecruitment(row, generated);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) =>
          document.documentElement.classList.toggle("dark", theme === "dark"),
        theme,
      );
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({
          width,
          height: width === 1440 ? 1050 : 844,
        });
        const geometry = await page.getByRole("dialog").evaluate((el) => ({
          width: el.clientWidth,
          scroll: el.scrollWidth,
        }));
        assert(geometry.scroll <= geometry.width + 1);
        await page.screenshot({
          path: `/tmp/ticket-hrreq20-modal-${theme}-${width}.png`,
          animations: "disabled",
        });
        check(`request-modal-${theme}-${width}`, "passed", geometry);
      }
    }
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.setViewportSize({ width: 1600, height: 1050 });
    const first = report.records[0];
    const request = (await openRecruitment(first, first.recruitments[0]))
      .results;
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Sao chép", exact: true })
      .click();
    const url = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(new URL(url).pathname, `/cv/${request.link_cv}`);
    const publicPage = await page.context().newPage();
    const response = await publicPage.goto(url);
    report.publicCv = {
      url,
      status: response?.status(),
      heading: await publicPage.getByRole("heading").allTextContents(),
    };
    save();
    check(
      "request-public-cv-link",
      response?.ok() ? "passed" : "failed",
      report.publicCv,
    );
    await publicPage.close();
  }
  async function attachment() {
    const row = report.records.find((x) => x.index === 5);
    const generated = row.recruitments[0];
    await openRecruitment(row, generated);
    const link = page
      .getByRole("dialog")
      .getByRole("link", { name: row.upload.name, exact: true });
    const href = await link.getAttribute("href");
    const attachment = await page.context().newPage();
    const response = await attachment.goto(href);
    const content = await attachment.locator("body").innerText();
    const expected = `${row.key} Job description TEST file`;
    check(
      "request-attachment-download",
      response?.ok() && content.trim() === expected ? "passed" : "failed",
      {
        href,
        status: response?.status(),
        matches: content.trim() === expected,
      },
    );
    await attachment.close();
  }
  async function candidates() {
    report.candidates ||= [];
    for (const index of [1, 20]) {
      if (report.candidates.some((item) => item.index === index)) continue;
      const row = report.records.find((x) => x.index === index),
        generated = row.recruitments[0];
      await list();
      await page
        .getByRole("row")
        .filter({
          has: page.getByText(generated.rec_position, { exact: true }),
        })
        .getByRole("button", {
          name: `Thêm ứng viên ${row.ticketCode}`,
          exact: true,
        })
        .click();
      const name = `${row.key} CV tuyển dụng`;
      await page.locator("#recruitment-first_name").fill(name);
      await page
        .locator("#recruitment-numberphone")
        .fill(index === 1 ? "0900010001" : "0900010020");
      await page
        .locator("#recruitment-email")
        .fill(`test-hrreq20-${index}@example.invalid`);
      for (const label of ["Tỉnh/Thành phố", "Quận/Huyện"]) {
        await page
          .getByRole("dialog")
          .getByRole("combobox", { name: label, exact: true })
          .click();
        await page.getByRole("option").first().click();
      }
      await page
        .locator("#recruitment-address")
        .fill(`${row.key} TEST Địa chỉ`);
      const pending = waitPath(page, `/api/detail_cv/${generated.id}`, "POST");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Lưu", exact: true })
        .click();
      const response = await pending;
      const data = await response.json();
      assert(response.ok(), JSON.stringify(data));
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      const loaded = waitPath(page, "/api/list_cv/");
      await page.goto(
        `${base}/recruitment/candidates?from_date=2026-10-21&to_date=2026-10-21&search=${encodeURIComponent(row.key)}&page_size=100`,
      );
      const results = await (await loaded).json();
      const cv = results.results.find((item) => item.first_name === name);
      assert(cv);
      assert.equal(cv.ticket_code, row.ticketCode);
      assert.equal(
        cv.department_recruited_name,
        "TEST_20261020_G3CCBK Dept OK",
      );
      report.candidates.push({
        index,
        id: cv.id,
        name,
        ticketCode: cv.ticket_code,
        requestId: generated.id,
        code: cv.code_cv,
      });
      save();
      check(`candidate-from-new-request-${index}`, "passed", {
        id: cv.id,
        requestId: generated.id,
        ticketCode: cv.ticket_code,
      });
    }
  }
  async function status() {
    for (const index of [17, 18]) {
      const row = report.records.find((item) => item.index === index);
      let detail = await ticketDetail(page, row);
      row.statusActions = Object.keys(detail.list_button || {});
      save();
      if (
        !row.statusActions.includes("Tiếp nhận") &&
        detail.ticket_status === 2
      ) {
        check(`request-lifecycle-${index}`, "skipped", {
          reason:
            "Provided admin account has no HR receive action on this ticket",
          actions: row.statusActions,
        });
        continue;
      }
      const actions = detail.ticket_status === 2 ? ["Tiếp nhận"] : [];
      if (index === 18 && detail.ticket_status !== 4)
        actions.push("Hoàn thành");
      for (const action of actions) {
        const button = page.getByRole("button", { name: action, exact: true });
        if (!(await button.count())) {
          check(`request-action-${index}-${action}`, "skipped", {
            reason: "Action not granted by the API",
          });
          continue;
        }
        await button.click();
        const dialog = page.getByRole("dialog");
        const pending = waitPath(
          page,
          action === "Tiếp nhận" ? "/api/receive_ticket/" : "/api/done_ticket/",
          "POST",
        );
        await dialog.getByRole("button", { name: action, exact: true }).click();
        const response = await pending;
        assert(response.ok());
        await dialog.waitFor({ state: "hidden" });
        detail = await ticketDetail(page, row);
        row.finalTicketStatus = detail.ticket_status;
        save();
        check(`request-action-${index}-${action}`, "passed", {
          ticketId: row.ticketId,
          status: detail.ticket_status,
        });
      }
    }
    const current = await list();
    for (const row of report.records.filter((item) => item.finalTicketStatus)) {
      const found = current.data.results.filter(
        (item) => item.ticket_code === row.ticketCode,
      );
      assert(found.length);
      assert(
        found.every((item) => item.ticket_status_id === row.finalTicketStatus),
      );
      check(`request-state-synchronization-${row.index}`, "passed", {
        ticketStatus: row.finalTicketStatus,
      });
      await list();
      await choose(
        page,
        "Trạng thái yêu cầu",
        row.finalTicketStatus === 3 ? "Đang xử lý" : "Hoàn thành",
      );
      const pending = waitPath(page, "/api/list_recruitment/");
      await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
      const filtered = await (await pending).json();
      assert(
        filtered.results.every(
          (item) => item.ticket_status_id === row.finalTicketStatus,
        ),
      );
      check(`request-filter-state-${row.finalTicketStatus}`, "passed", {
        count: filtered.count,
      });
    }
  }
  const phases = {
    create,
    status,
    candidates,
    approve,
    verify,
    edit,
    filters,
    presentation,
    attachment,
    diagnose,
    legacy,
    discardFailed,
  };
  assert(phases[phase], `Unknown phase ${phase}`);
  await phases[phase]();
};
