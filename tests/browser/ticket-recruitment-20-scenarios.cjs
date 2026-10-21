const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
module.exports = async (phase, ctx) => {
  const {
    page,
    report,
    save,
    check,
    prefix,
    today,
    base,
    pdf,
    submit,
    choose,
    close,
    candidates,
    openCandidate,
    waitPath,
  } = ctx;
  const active = () => report.records.filter((row) => !row.deleted);
  async function detail(row) {
    const pending = waitPath(page, `/api/detail_cv/${row.id}`);
    await openCandidate(row);
    const response = await pending;
    assert(response.ok(), `Detail ${row.id} failed`);
    return (await response.json()).results;
  }
  async function select(label, value) {
    await page.getByRole("combobox", { name: label, exact: true }).click();
    await page.getByRole("option", { name: value, exact: true }).click();
  }
  async function listResponseAfter(action) {
    const pending = waitPath(page, "/api/list_cv/");
    await action();
    const response = await pending;
    if (!response.ok())
      return { status: response.status(), rows: [], count: 0 };
    const body = await response.json();
    await page
      .locator('section[aria-label="Danh sách ứng viên"][aria-busy="false"]')
      .waitFor();
    return { status: response.status(), rows: body.results, count: body.count };
  }
  async function verify() {
    await candidates();
    for (const row of active()) {
      const data = await detail(row),
        sent = row.createdValues;
      const mismatches = [];
      for (const key of [
        "first_name",
        "numberphone",
        "gender",
        "email",
        "city_code",
        "district_code",
        "address",
      ])
        if (
          String(data[key] ?? "") !==
          String(
            key === "address" &&
              report.writes.some(
                (write) =>
                  write.phase === "verify" &&
                  write.path === `/api/detail_cv/${row.id}` &&
                  write.method === "PUT",
              )
              ? `${row.key} địa chỉ UPDATED`
              : (sent[key] ?? ""),
          )
        )
          mismatches.push({
            field: key,
            expected: sent[key] ?? "",
            actual: data[key],
          });
      if ([12, 13].includes(row.index)) {
        const expected = row.index === 12 ? "2020-01-01" : today;
        const uiValue = await page
          .locator("#recruitment-application_date")
          .inputValue();
        const wanted = expected.split("-").reverse().join("/");
        if (uiValue !== wanted)
          mismatches.push({
            field: "application_date",
            expected: wanted,
            actual: uiValue,
            stored: data.application_date,
          });
      }
      check(`readback-${row.index}`, mismatches.length ? "failed" : "passed", {
        recordId: row.id,
        mismatches,
      });
      if (mismatches.length) {
        row.readbackMismatches = mismatches;
        save();
      }
      if (!row.edited) {
        const note = `${row.key} UPDATED qua giao diện`,
          address = `${row.key} địa chỉ UPDATED`;
        await page.locator("#recruitment-note").fill(note);
        await page.locator("#recruitment-address").fill(address);
        await submit(`/api/detail_cv/${row.id}`, "PUT");
        await candidates();
        const pendingNotes = waitPath(page, `/api/note-cv/${row.id}`).then(
          (response) => response.json(),
        );
        const [updated, notes] = await Promise.all([detail(row), pendingNotes]);
        assert.equal(updated.address, address);
        assert(
          notes.some((item) => item.content === note || item.note === note),
          `Updated note ${row.id} not persisted`,
        );
        await page.getByText(note, { exact: true }).first().waitFor();
        row.edited = { note, address };
        save();
        check(`edit-readback-${row.index}`, "passed", { recordId: row.id });
      }
      await close();
    }
    // A real duplicate check must identify another TEST candidate, not just render an empty modal.
    for (const index of [1, 2]) {
      const row = active().find((item) => item.index === index);
      const pending = waitPath(page, `/api/check-cv/${row.id}`);
      await openCandidate(row, "Kiểm tra trùng");
      const data = await (await pending).json();
      const expected = active().find(
        (item) => item.index === (index === 1 ? 19 : 20),
      );
      const duplicates = data.results || [];
      assert(
        duplicates.some((item) => Number(item.id) === expected.id),
        `Duplicate checker missed TEST ${expected.id}`,
      );
      await page.getByRole("table", { name: "Hồ sơ trùng" }).waitFor();
      await close();
      check(`duplicate-positive-${index}`, "passed", {
        originalId: row.id,
        duplicateId: expected.id,
      });
    }
  }
  const statusNames = new Map([
    [1, "Chờ duyệt"],
    [2, "Chờ phỏng vấn"],
    [3, "Chờ kết quả"],
    [4, "Không đạt"],
    [5, "Đạt"],
    [6, "Tiềm năng"],
    [8, "Offer"],
    [9, "Không nhận việc"],
    [10, "Đã nhận việc"],
  ]);
  async function changeStatus(row, target, validateBlank = false) {
    if (row.currentStatus === target) return;
    await openCandidate(row, "Chuyển trạng thái");
    if (validateBlank) {
      const before = report.writes.length;
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Lưu", exact: true })
        .click();
      await page
        .getByText("Vui lòng chọn trạng thái.", { exact: true })
        .waitFor();
      assert.equal(report.writes.length, before);
      check("empty-status-no-write", "passed");
    }
    await page
      .getByRole("dialog")
      .getByRole("combobox", { name: "Trạng thái", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("option", {
          name: statusNames.get(row.currentStatus),
          exact: true,
        })
        .count(),
      0,
      "Current status is offered as a target",
    );
    await page
      .getByRole("option", { name: statusNames.get(target), exact: true })
      .click();
    await page
      .locator("#recruitment-why_change")
      .fill(`${row.key} QC ${row.currentStatus} -> ${target}`);
    await submit(`/api/change_status_cv/${row.id}`, "PUT");
    row.currentStatus = target;
    save();
    check(`status-${row.index}-${target}`, "passed", {
      recordId: row.id,
      status: target,
      name: statusNames.get(target),
    });
  }
  async function statuses() {
    await candidates();
    const targetIds = [...statusNames.keys()];
    const paths = {
      1: [1],
      2: [2],
      3: [2, 3],
      4: [2, 3, 4],
      5: [2, 3, 5],
      6: [2, 3, 6],
      8: [2, 3, 5, 8],
      9: [2, 3, 5, 8, 9],
      10: [2, 3, 5, 8, 10],
    };
    for (const row of active()) {
      const target = targetIds[(row.index - 1) % targetIds.length];
      if (row.currentStatus !== target) {
        const path = paths[target];
        let cursor = path.indexOf(row.currentStatus);
        for (const step of path.slice(cursor + 1))
          await changeStatus(row, step, row.index === 2 && step === 2);
      }
      row.targetStatus = target;
      save();
    }
    const listed = await candidates();
    for (const row of active())
      assert.equal(
        listed.data.results.find((item) => item.id === row.id).cv_status_id,
        row.targetStatus,
      );
    check("all-statuses-persisted", "passed", {
      represented: [...new Set(active().map((row) => row.targetStatus))],
      count: active().length,
    });
  }
  async function filters() {
    const listed = await candidates();
    assert.equal(listed.data.count, active().length);
    // Pagination is operated through UI, with explicit disjoint page assertions.
    let current = await listResponseAfter(async () => {
      await select("Số ứng viên mỗi trang", "10 / trang");
    });
    assert.equal(current.rows.length, 10);
    const firstIds = current.rows.map((row) => row.id);
    await page
      .getByRole("checkbox", {
        name: `Chọn CV ${current.rows[0].code_cv}`,
        exact: true,
      })
      .check();
    current = await listResponseAfter(() =>
      page.getByRole("button", { name: "Trang sau", exact: true }).click(),
    );
    assert.equal(current.rows.length, 10);
    assert(current.rows.every((row) => !firstIds.includes(row.id)));
    assert(
      await page
        .getByRole("button", { name: "Gắn lịch (0)", exact: true })
        .isDisabled(),
    );
    await page
      .getByRole("button", { name: "Trang trước", exact: true })
      .click();
    for (const id of firstIds) {
      const row = report.records.find((item) => item.id === id);
      await page
        .getByRole("button", { name: `Sửa hồ sơ ${row.code}`, exact: true })
        .waitFor();
    }
    check("pagination-20-and-clear-selection", "passed");
    for (const [id, name] of statusNames) {
      if (
        report.checks.some(
          (item) =>
            item.id === `filter-status-${id}` && item.result === "passed",
        )
      )
        continue;
      await candidates();
      current = await listResponseAfter(() =>
        select("Trạng thái CV", name).then(() =>
          page.getByRole("button", { name: "Tìm kiếm", exact: true }).click(),
        ),
      );
      const expected = active().filter(
        (row) => row.currentStatus === id,
      ).length;
      assert.equal(current.status, 200);
      assert.equal(current.count, expected);
      assert(current.rows.every((row) => row.cv_status_id === id));
      check(`filter-status-${id}`, "passed", { expectedCount: expected });
    }
    await candidates();
    await page
      .getByRole("button", { name: "Lọc nâng cao", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("combobox", { name: "Giới tính", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("combobox", { name: "Tỉnh/Thành phố", exact: true })
        .count(),
      0,
    );
    await page
      .getByLabel("Mã yêu cầu tuyển dụng", { exact: true })
      .fill(report.recruitment.code);
    current = await listResponseAfter(() =>
      page.getByRole("button", { name: "Áp dụng bộ lọc", exact: true }).click(),
    );
    assert.equal(current.count, active().length);
    check("advanced-ticket-code-supported-filter", "passed");
    await page
      .getByRole("button", { name: "Lọc nâng cao", exact: true })
      .click();
    current = await listResponseAfter(() =>
      page
        .getByRole("button", { name: "Xóa bộ lọc nâng cao", exact: true })
        .click(),
    );
    assert.equal(current.count, active().length);
    assert.equal(new URL(page.url()).searchParams.get("search"), prefix);
    check("clear-advanced-preserves-prefix", "passed");
    await candidates();
    await page
      .getByRole("button", { name: "Lọc nâng cao", exact: true })
      .click();
    await page.locator("#recruitment-filter-from").fill("21/10/2026");
    await page.locator("#recruitment-filter-to").fill("21/10/2026");
    current = await listResponseAfter(() =>
      page.getByRole("button", { name: "Áp dụng bộ lọc", exact: true }).click(),
    );
    assert.equal(current.count, active().length);
    check(
      "equal-creation-date-range-includes-historical-application",
      "passed",
      { count: current.count, dateFilter: "creation date" },
    );
    const missing = await candidates({ search: prefix + "_NO_MATCH" });
    check(
      "search-with-no-results",
      missing.status === 200 ? "passed" : "failed",
      {
        status: missing.status,
        layer: missing.status === 200 ? "ui" : "backend",
      },
    );
    await candidates();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Xuất Excel", exact: true }).click();
    const download = await pending;
    assert.equal(await download.failure(), null);
    const bytes = fs.statSync(await download.path()).size;
    assert(bytes > 0);
    check("export-20-filtered-candidates", "passed", {
      filename: download.suggestedFilename(),
      bytes,
    });
  }
  async function calendar() {
    const pending = waitPath(page, "/api/list-interview/");
    await page.goto(`${base}/recruitment/interviews`);
    const data = await (await pending).json();
    await page.getByRole("grid", { name: "Lịch phỏng vấn" }).waitFor();
    return data.results;
  }
  async function interviews() {
    report.interviews ||= [];
    save();
    const plans = [
      { key: "A", date: "22/10/2026", start: "13:00", end: "14:00" },
      { key: "B", date: "22/10/2026", start: "14:00", end: "15:00" },
      { key: "C", date: "23/10/2026", start: "14:00", end: "15:00" },
      { key: "DELETE", date: "24/10/2026", start: "15:00", end: "16:00" },
    ];
    for (const plan of plans) {
      if (report.interviews.some((row) => row.key === plan.key)) continue;
      const list = await calendar();
      const title = `${prefix} Interview ${plan.key}`;
      let existing = list.find((row) => row.title === title);
      if (!existing) {
        await page
          .getByRole("button", { name: "Tạo lịch phỏng vấn", exact: true })
          .click();
        await page.locator("#recruitment-title").fill(title);
        await page.locator("#recruitment-start_date").fill(plan.date);
        await page.locator("#recruitment-time_start").fill(plan.start);
        await page.locator("#recruitment-time_end").fill(plan.end);
        await page
          .locator("#recruitment-note")
          .fill(`${prefix} no interviewers; isolated UI QC`);
        await submit("/api/regis-interview/", "POST");
        existing = (await calendar()).find((row) => row.title === title);
      }
      assert(existing);
      report.interviews.push({ ...plan, id: existing.id, title });
      save();
      check(`interview-create-${plan.key}`, "passed", {
        recordId: existing.id,
        title,
      });
    }
    const main = report.interviews.find((row) => row.key === "A");
    await calendar();
    await page
      .getByRole("button", { name: `Sửa lịch ${main.title}`, exact: true })
      .click();
    await page.locator("#recruitment-note").fill(`${prefix} edited calendar`);
    const edited = await submit("/api/regis-interview/", "PUT");
    const persisted = (await calendar()).find((row) => row.id === main.id);
    check(
      "interview-edit-reload",
      persisted.note === `${prefix} edited calendar` ? "passed" : "failed",
      {
        layer: "backend",
        status: edited.response.status(),
        actual: persisted.note,
        requested: `${prefix} edited calendar`,
        payload: edited.response
          .request()
          .postData()
          ?.match(/name="values"\r\n\r\n([\s\S]*?)\r\n--/)?.[1],
      },
    );
    await candidates();
    for (const row of active()) await changeStatus(row, 2);
    // All 20 candidates are selected by real checkboxes and assigned together.
    await candidates();
    for (const row of active())
      await page
        .getByRole("checkbox", { name: `Chọn CV ${row.code}`, exact: true })
        .check();
    await page
      .getByRole("button", { name: "Gắn lịch (20)", exact: true })
      .click();
    await page.locator("#recruitment-start_date").fill(main.date);
    await choose(
      "Lịch phỏng vấn",
      `${main.title} (${main.start}:00 - ${main.end}:00)`,
    );
    await submit("/api/add-cv-interview/", "POST");
    check("bulk-assign-20", "passed", { interviewId: main.id });
    await calendar();
    await page
      .getByRole("button", { name: `Xem CV lịch ${main.title}`, exact: true })
      .click();
    await page.waitForURL(/\/recruitment\/interviews\/[^/]+$/);
    report.interviewUrl = new URL(page.url()).pathname;
    save();
    await page.getByRole("table", { name: "CV phỏng vấn" }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: /^Đặt giờ / }).count(),
      20,
    );
    check("bulk-readback-20-in-interview", "passed");
    for (const row of active()) {
      await page
        .getByRole("button", { name: `Đặt giờ ${row.name}`, exact: true })
        .click();
      const minute = (row.index - 1) * 3;
      const time = `13:${String(minute).padStart(2, "0")}`;
      await page.locator("#recruitment-time_start").fill(time);
      await submit("/api/detail-cv-interview/", "POST");
      row.interviewTime = time;
      save();
      check(`candidate-slot-${row.index}`, "passed", { time });
      await page
        .getByRole("button", { name: `Ghi chú ${row.name}`, exact: true })
        .click();
      const note = `${row.key} Phản hồi phỏng vấn TEST`;
      await page.locator("#recruitment-note").fill(note);
      let upload;
      if (row.index % 5 === 0) {
        upload = { name: `${row.key}_feedback.pdf`, buffer: pdf(row.key) };
        await page.locator("#recruitment-file_note").setInputFiles({
          name: upload.name,
          mimeType: "application/pdf",
          buffer: upload.buffer,
        });
      }
      await submit("/api/note-cv/", "POST");
      await page
        .getByRole("button", { name: `Xem hồ sơ ${row.name}`, exact: true })
        .click();
      await page.locator("#recruitment-first_name").waitFor();
      assert(await page.locator("#recruitment-first_name").isDisabled());
      assert.equal(
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Lưu", exact: true })
          .count(),
        0,
      );
      await page.getByText(note, { exact: true }).first().waitFor();
      if (upload) {
        const pending = page.waitForEvent("download");
        await page
          .getByRole("dialog")
          .getByRole("button", { name: upload.name, exact: true })
          .click();
        const file = await pending;
        assert.equal(await file.failure(), null);
        const downloaded = fs.readFileSync(await file.path());
        assert.equal(
          crypto.createHash("sha256").update(downloaded).digest("hex"),
          crypto.createHash("sha256").update(upload.buffer).digest("hex"),
        );
        check(`note-file-download-${row.index}`, "passed", {
          bytes: downloaded.length,
        });
      }
      await close();
      check(`note-readonly-readback-${row.index}`, "passed");
    }
    const pending = waitPath(
      page,
      `/api/regis-interview/${decodeURIComponent(report.interviewUrl.split("/").pop())}`,
    );
    await page.reload();
    const data = await (await pending).json();
    assert.equal(data[0].ls_cv_interview.length, 20);
    for (const row of active())
      assert.equal(
        data[0].ls_cv_interview
          .find((item) => item.id === row.id)
          .data_interview_cv.time_start.slice(0, 5),
        row.interviewTime,
      );
    check("all-slots-persist-after-reload", "passed");
    for (const row of report.records.filter(
      (item) => item.index >= 19 && !item.deleted,
    )) {
      await page
        .getByRole("button", { name: `Bỏ khỏi lịch ${row.name}`, exact: true })
        .click();
      await submit("/api/del-cv-interview/", "DELETE");
      await page
        .getByRole("button", { name: `Đặt giờ ${row.name}`, exact: true })
        .waitFor({ state: "hidden" });
      check(`remove-from-interview-${row.index}`, "passed");
    }
    const temporary = report.interviews.find((row) => row.key === "DELETE");
    await calendar();
    await page
      .getByRole("button", { name: `Xóa lịch ${temporary.title}`, exact: true })
      .click();
    await submit(`/api/regis-interview/${temporary.id}`, "DELETE");
    assert(!(await calendar()).some((row) => row.id === temporary.id));
    temporary.deleted = true;
    save();
    check("interview-delete-reload", "passed", { recordId: temporary.id });
  }
  async function cleanup() {
    await candidates();
    for (const row of report.records.filter(
      (item) => item.index >= 19 && !item.deleted,
    )) {
      const delFile = page.getByRole("button", {
        name: `Xóa tệp CV ${row.code}`,
        exact: true,
      });
      if (await delFile.count()) {
        await delFile.click();
        await submit("/api/del-file-cv/", "POST");
        await delFile.waitFor({ state: "hidden" });
        check(`delete-file-${row.index}`, "passed");
      }
      await openCandidate(row, "Xóa hồ sơ");
      await submit("/api/del-data-cv/", "POST");
      row.deleted = true;
      save();
      await page
        .getByRole("button", { name: `Sửa hồ sơ ${row.code}`, exact: true })
        .waitFor({ state: "hidden" });
      check(`delete-candidate-${row.index}`, "passed", { recordId: row.id });
    }
    const current = await candidates();
    assert.equal(current.data.count, 18);
    check("final-retained-18-of-20", "passed", {
      created: 20,
      deleted: 2,
      retained: 18,
    });
  }
  async function probes() {
    report.extraRecords ||= [];
    for (const kind of ["MIN_ADDRESS", "MISSING_ADDRESS"]) {
      const name = `${prefix}_AUX_${kind}`;
      await ctx.requests();
      await page
        .getByRole("button", {
          name: `Thêm ứng viên ${report.recruitment.code}`,
          exact: true,
        })
        .click();
      await page.locator("#recruitment-first_name").fill(name);
      await page
        .locator("#recruitment-numberphone")
        .fill(kind === "MIN_ADDRESS" ? "0900000091" : "0900000092");
      await choose("Tỉnh/Thành phố");
      await choose("Quận/Huyện");
      if (kind === "MIN_ADDRESS")
        await page
          .locator("#recruitment-address")
          .fill(`${prefix} AUX address`);
      else {
        await page.locator("#recruitment-birthday").fill("01/01/2000");
        await page
          .locator("#recruitment-email")
          .fill("qc20-aux@example.invalid");
        await page.locator("#recruitment-language_skill").fill("TEST English");
        await page.locator("#recruitment-education_major").fill("TEST QC");
        await choose("Trình độ học vấn");
        await choose("Nguồn ứng viên");
        await page.locator("#recruitment-file_upload").setInputFiles({
          name: `${name}.pdf`,
          mimeType: "application/pdf",
          buffer: pdf(name),
        });
      }
      async function attempt() {
        const pending = waitPath(
          page,
          `/api/detail_cv/${report.recruitment.id}`,
          "POST",
        );
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Lưu", exact: true })
          .click();
        const response = await pending;
        const data = await response.json();
        if (response.ok())
          await page.getByRole("dialog").waitFor({ state: "hidden" });
        return { status: response.status(), data };
      }
      let result = await attempt();
      check(
        `probe-${kind}-initial`,
        result.status === 200 ? "passed" : "failed",
        {
          status: result.status,
          observation:
            kind === "MIN_ADDRESS"
              ? "Address supplied; birthday, email, education, source and CV file omitted."
              : "Only address omitted from an otherwise valid full candidate payload.",
        },
      );
      if (result.status !== 200) {
        if (kind === "MISSING_ADDRESS")
          await page
            .locator("#recruitment-address")
            .fill(`${prefix} AUX address recovered`);
        else {
          await page.locator("#recruitment-birthday").fill("01/01/2000");
          await page
            .locator("#recruitment-email")
            .fill("qc20-aux-min@example.invalid");
        }
        result = await attempt();
        assert.equal(result.status, 200, JSON.stringify(result));
        check(`probe-${kind}-recovery`, "passed", { status: result.status });
      }
      const list = await candidates();
      const row = list.data.results.find((item) => item.first_name === name);
      assert(row);
      report.extraRecords.push({
        id: row.id,
        code: row.code_cv,
        name,
        kind,
        deleted: false,
      });
      save();
    }
    await candidates();
    for (const row of report.extraRecords.filter((item) => !item.deleted)) {
      assert(row.name.startsWith(prefix + "_AUX_"));
      await page
        .getByRole("button", { name: `Xóa hồ sơ ${row.code}`, exact: true })
        .click();
      await submit("/api/del-data-cv/", "POST");
      row.deleted = true;
      save();
    }
    assert.equal((await candidates()).data.count, 20);
    check("diagnostic-fixtures-cleaned", "passed", {
      created: report.extraRecords.length,
      retainedMain: 20,
    });
  }
  async function reports() {
    for (const kind of ["requests", "candidates"]) {
      if (kind === "candidates") await candidates();
      else await ctx.requests();
      const pending = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Xuất Excel", exact: true })
        .click();
      const file = await pending;
      assert.equal(await file.failure(), null);
      const bytes = fs.statSync(await file.path()).size;
      assert(bytes > 0);
      check(`export-${kind}`, "passed", {
        filename: file.suggestedFilename(),
        bytes,
      });
    }
    await page.goto(`${base}/recruitment/reports`);
    await page.locator("#recruitment-filter-from").fill("21/10/2026");
    await page.locator("#recruitment-filter-to").fill("21/10/2026");
    const pending = waitPath(page, "/api/report_rect/");
    await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
    const response = await pending;
    assert(response.ok());
    const data = await response.json();
    report.reportCounts = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.length : typeof value,
      ]),
    );
    save();
    for (const name of [
      "Theo yêu cầu tuyển dụng",
      "Theo bộ phận",
      "Theo người phụ trách",
      "Thời gian tuyển dụng",
      "Theo nguồn ứng viên",
      "Tỷ lệ chuyển đổi CV",
      "Trạng thái CV",
      "Bộ phận theo tháng",
    ]) {
      await page.getByRole("tab", { name, exact: true }).click();
      await page.getByRole("tabpanel", { name, exact: true }).waitFor();
      check(`report-tab-${name}`, "passed");
    }
    const downloaded = page.waitForEvent("download").catch(() => null);
    const exporting = waitPath(page, "/api/export_rect/", "POST");
    await page.getByRole("button", { name: "Xuất Excel", exact: true }).click();
    const exported = await exporting;
    if (exported.ok()) {
      const file = await downloaded;
      assert(file);
      assert.equal(await file.failure(), null);
      assert(fs.statSync(await file.path()).size > 0);
      check("export-report-real-created-day", "passed", {
        filename: file.suggestedFilename(),
      });
    } else {
      await page
        .getByText(`HTTP Error! Status: ${exported.status()}`, { exact: true })
        .waitFor();
      check("export-report-real-created-day", "failed", {
        status: exported.status(),
        layer: "backend",
        from: today,
        to: today,
      });
    }
    await page.locator("#recruitment-filter-from").fill("01/01/2020");
    const before = report.writes.length;
    await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
    await page
      .getByText("Phạm vi tra cứu không quá 6 tháng.", { exact: true })
      .waitFor();
    assert.equal(report.writes.length, before);
    check("report-max-range-validation", "passed");
  }
  async function repair() {
    await candidates();
    for (const row of active().filter((item) =>
      [12, 13].includes(item.index),
    )) {
      await detail(row);
      const expected = row.index === 12 ? "01/01/2020" : "21/10/2026";
      await page.locator("#recruitment-application_date").fill(expected);
      await page.locator("#recruitment-note").fill("");
      await submit(`/api/detail_cv/${row.id}`, "PUT");
      await candidates();
      await detail(row);
      assert.equal(
        await page.locator("#recruitment-application_date").inputValue(),
        expected,
      );
      await close();
      row.dateRepair = { expected, verified: true };
      save();
      check(`application-date-regression-${row.index}`, "passed", {
        recordId: row.id,
        expected,
      });
    }
    await ctx.requests();
    await page
      .getByRole("button", {
        name: `Thêm ứng viên ${report.recruitment.code}`,
        exact: true,
      })
      .click();
    await page
      .locator("#recruitment-first_name")
      .fill(`${prefix}_UNSAVED_ADDRESS`);
    await page.locator("#recruitment-numberphone").fill("0900000099");
    await choose("Tỉnh/Thành phố");
    await choose("Quận/Huyện");
    const before = report.writes.length;
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Lưu", exact: true })
      .click();
    await page.getByText("Vui lòng nhập địa chỉ.", { exact: true }).waitFor();
    assert.equal(report.writes.length, before);
    await page
      .locator("#recruitment-address")
      .fill("TEST address validation recovered");
    await page
      .getByText("Vui lòng nhập địa chỉ.", { exact: true })
      .waitFor({ state: "hidden" });
    await close();
    check("required-address-blocks-before-api-and-recovers", "passed");
  }
  async function edges() {
    const main = report.interviews.find((row) => row.key === "A");
    const persisted = (await calendar()).find((row) => row.id === main.id);
    check(
      "interview-note-delayed-readback",
      persisted.note === `${prefix} edited calendar` ? "passed" : "failed",
      {
        actual: persisted.note,
        requested: `${prefix} edited calendar`,
        layer: "backend",
      },
    );
    await candidates();
    const row = active().find((item) => item.index === 17);
    await detail(row);
    await page.setViewportSize({ width: 390, height: 844 });
    const geometry = await page
      .getByRole("dialog")
      .evaluate((el) => ({ width: el.clientWidth, scroll: el.scrollWidth }));
    check(
      "long-note-mobile-dialog",
      geometry.scroll <= geometry.width + 1 ? "passed" : "failed",
      geometry,
    );
    await close();
    await page.setViewportSize({ width: 1600, height: 1050 });
    await ctx.requests();
    await page
      .getByRole("button", {
        name: `Thêm ứng viên ${report.recruitment.code}`,
        exact: true,
      })
      .click();
    const before = report.writes.length;
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Lưu", exact: true })
      .click();
    for (const phone of ["123456789", "1234567890123", "abcdefghij"]) {
      await page.locator("#recruitment-numberphone").fill(phone);
      await page
        .getByText("Số điện thoại phải có từ 10 đến 12 chữ số.", {
          exact: true,
        })
        .waitFor();
    }
    await page.locator("#recruitment-numberphone").fill("0900000000");
    await page
      .getByText("Số điện thoại phải có từ 10 đến 12 chữ số.", { exact: true })
      .waitFor({ state: "hidden" });
    check("phone-9-13-alpha-rejected-recovery", "passed");
    await page.locator("#recruitment-file_upload").setInputFiles({
      name: "TEST_limit_plus_one.pdf",
      mimeType: "application/pdf",
      buffer: pdf(prefix, 10 * 1024 * 1024 + 1),
    });
    await page
      .getByText("Tệp không được vượt quá 10 MB.", { exact: true })
      .waitFor();
    await page.locator("#recruitment-file_upload").setInputFiles([]);
    await page
      .getByText("Tệp không được vượt quá 10 MB.", { exact: true })
      .waitFor({ state: "hidden" });
    check("cv-10mb-plus-one-byte-rejected-recovery", "passed");
    await close();
    await candidates();
    await detail(row);
    const largeNote = `/tmp/${prefix}_note_limit.pdf`;
    fs.writeFileSync(largeNote, Buffer.alloc(50 * 1024 * 1024 + 1));
    try {
      await page.locator("#recruitment-file_note").setInputFiles(largeNote);
    } finally {
      fs.unlinkSync(largeNote);
    }
    await page
      .getByText("Tệp không được vượt quá 50 MB.", { exact: true })
      .waitFor();
    await page.locator("#recruitment-file_note").setInputFiles([]);
    await page
      .getByText("Tệp không được vượt quá 50 MB.", { exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(report.writes.length, before);
    check("note-50mb-plus-one-byte-rejected-no-write", "passed");
    await close();
  }
  const phases = {
    edges,
    verify,
    statuses,
    filters,
    interviews,
    cleanup,
    probes,
    reports,
    repair,
  };
  assert(phases[phase], `Unknown phase ${phase}`);
  await phases[phase]();
};
