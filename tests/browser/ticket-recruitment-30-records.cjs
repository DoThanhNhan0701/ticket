const ticketTestEnv = require("../env.cjs");
// Live recruitment regression. JSON credentials {username,password} arrive on stdin.
// Browser login; live API readback for 30 isolated TEST profiles; no mocked responses.
// Run QC_PHASE=create, workflows, edges, then ui. Reuse the report to resume.
// The UI phase exits nonzero if the completed run contains an open backend issue.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = ticketTestEnv.baseUrl;
const artifact =
  process.env.QC_REPORT || "tests/artifacts/ticket-recruitment-30-records.json";
const phase = process.env.QC_PHASE || "create";
const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
}).format(new Date());
const report = fs.existsSync(artifact)
  ? JSON.parse(fs.readFileSync(artifact, "utf8"))
  : {
      prefix: "TEST_REC30_" + Date.now().toString(36).toUpperCase(),
      method:
        "Live browser login and UI actions with real API CRUD/readback. No mocks. Writes restricted to this run’s TEST profiles and schedules.",
      records: [],
      checks: [],
      api: [],
      errors: [],
    };
const save = () =>
  fs.writeFileSync(artifact, JSON.stringify(report, null, 2) + "\n");
const checked = (name) =>
  report.checks.some((c) => c.name === name && c.result === "passed");
const recordCheck = (entry) => {
  const index = report.checks.findIndex((check) => check.name === entry.name);
  if (index < 0) report.checks.push(entry);
  else report.checks[index] = entry;
  save();
  console.log(JSON.stringify(entry));
};
const check = (name, details = {}) =>
  recordCheck({ name, result: "passed", ...details });
function attachment(index) {
  const kinds = [
    ["txt", "text/plain", Buffer.from("TEST Tuyển dụng: ghi chú UTF-8")],
    [
      "png",
      "image/png",
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWQAAAABJRU5ErkJggg==",
        "base64",
      ),
    ],
    ["csv", "text/csv", Buffer.from("name,result\nTEST,passed\n")],
    ["json", "application/json", Buffer.from('{"test":true}')],
    ["md", "text/markdown", Buffer.from("# TEST recruitment\n")],
    [
      "",
      "application/octet-stream",
      Buffer.from("TEST extensionless attachment"),
    ],
    [
      "zip",
      "application/zip",
      Buffer.from("504b0506000000000000000000000000000000000000", "hex"),
    ],
  ];
  const [extension, mimeType, buffer] = kinds[(index - 1) % kinds.length];
  return {
    name: report.prefix + "_" + index + (extension ? "." + extension : ""),
    mimeType,
    buffer,
  };
}
async function eachRecord(rows, run) {
  for (let offset = 0; offset < rows.length; offset += 3) {
    const results = await Promise.allSettled(
      rows.slice(offset, offset + 3).map(run),
    );
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
  }
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1050 },
    timezoneId: "Asia/Ho_Chi_Minh",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on("pageerror", (e) => {
    report.errors.push(e.message);
    save();
  });
  let token;
  const owned = (id) =>
    assert(
      report.records.some((r) => r.id === Number(id)),
      "Not an owned TEST profile",
    );
  async function api(path, options = {}) {
    const started = Date.now();
    const response = await context.request.fetch(base + "/api" + path, {
      ...options,
      headers: { ...options.headers, Authorization: "Bearer " + token },
      timeout: 45000,
    });
    report.api.push({
      phase,
      path,
      method: options.method || "GET",
      status: response.status(),
      ms: Date.now() - started,
    });
    save();
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    assert(
      response.ok(),
      `${path}: HTTP ${response.status()} ${JSON.stringify(data).slice(0, 500)}`,
    );
    assert(!data?.error, `${path}: ${JSON.stringify(data)}`);
    return data;
  }
  const list = () =>
    api("/list_cv/?from_date=2020-01-01&to_date=2027-12-31&page_size=1000");
  const multipart = (values, file, field = "file_upload") => ({
    values: JSON.stringify(values),
    ...(file ? { [field]: file } : {}),
  });
  async function detail(row) {
    owned(row.id);
    return (await api("/detail_cv/" + row.id)).results;
  }
  async function waitList() {
    await page.locator('section[aria-busy="false"]').last().waitFor();
  }
  async function closeDialog(name) {
    const dialog = page.getByRole("dialog", { name, exact: true });
    await page
      .getByRole("dialog", { name, exact: true })
      .getByRole("button", {
        name: name === "Chọn thao tác" ? "Đóng chọn thao tác" : "Close dialog",
        exact: true,
      })
      .click();
    await dialog.waitFor({ state: "hidden" });
  }
  async function openAction(row, label, title) {
    await page
      .getByRole("button", { name: "Thao tác " + row.code, exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Chọn thao tác", exact: true })
      .getByRole("button", { name: label + " " + row.code, exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    await dialog.waitFor();
    return dialog;
  }
  try {
    await page.goto(base + "/login");
    await page.locator("#login-username").fill(credentials.username);
    await page.locator("#login-password").fill(credentials.password);
    await page
      .getByRole("button", { name: "Sign In to Ticket", exact: true })
      .click();
    await page.waitForURL((u) => u.pathname !== "/login");
    token = (await context.cookies()).find(
      (c) => c.name === "_access_token_ticket",
    ).value;
    const permissions = await api("/list_permission/");
    assert(
      Object.values(permissions.handlingPermission || {})
        .flat()
        .includes("can_hr_rec"),
    );
    assert(!permissions.is_superuser);
    report.account = {
      id: permissions.infoUser[0],
      username: credentials.username,
      superuser: false,
    };
    save();
    if (phase === "inspect") {
      const calendar = await api(
        "/list-interview/?from_date=" +
          report.interview.day +
          "&to_date=" +
          report.interview.day,
      );
      console.log(
        JSON.stringify(
          calendar.results.filter((row) => row.title.startsWith(report.prefix)),
        ),
      );
    }
    if (phase === "create") {
      const requests = await api(
        "/list_recruitment/?from_date=2020-01-01&to_date=2027-12-31&page_size=100",
      );
      const parent = requests.results.find((r) =>
        String(r.title).startsWith("TEST_HRREQ20_"),
      );
      assert(parent, "Existing TEST request needed");
      report.parent = {
        id: parent.id,
        code: parent.ticket_code,
        title: parent.title,
        readOnly: true,
      };
      save();
      const initial = await list();
      for (let index = 1; index <= 30; index++) {
        if (report.records.some((r) => r.index === index)) continue;
        const name =
          report.prefix +
          "_" +
          String(index).padStart(2, "0") +
          " Ứng viên " +
          (index % 2 ? "Nam" : "Nữ");
        const existing = initial.results.find((r) => r.first_name === name);
        if (existing) {
          report.records.push({
            index,
            id: existing.id,
            code: existing.code_cv,
            name,
          });
          save();
          continue;
        }
        const file = attachment(index);
        const values = {
          first_name: name,
          birthday: index === 4 ? "2000-02-29" : "2000-01-01",
          gender: index % 2 ? "Nam" : "Nữ",
          numberphone: "09830" + String(index).padStart(5, "0"),
          city_code: "01",
          district_code: "00004",
          address: report.prefix + " TEST address " + index,
          email: report.prefix.toLowerCase() + "-" + index + "@example.invalid",
          department_recruited: parent.department_recruited,
          education_major: "TEST IT",
          language_skill: "TEST English",
          application_date: today + "T00:00:00+07:00",
        };
        assert(values.first_name.startsWith(report.prefix));
        await api("/detail_cv/" + parent.id, {
          method: "POST",
          multipart: multipart(values, file),
        });
        const created = (await list()).results.find(
          (r) => r.first_name === name,
        );
        assert(created, "Created profile absent from list");
        const row = {
          index,
          id: created.id,
          code: created.code_cv,
          name,
          file: {
            name: file.name,
            bytes: file.buffer.length,
            sha256: crypto
              .createHash("sha256")
              .update(file.buffer)
              .digest("hex"),
          },
        };
        report.records.push(row);
        save();
        const read = await detail(row);
        assert.equal(read.first_name, name);
        assert.equal(read.city_code, "01");
        assert.equal(String(read.district_code), "00004");
        assert.equal(read.name_file_cv, file.name);
        check("create-readback-" + index, {
          recordId: row.id,
          file: file.name,
        });
      }
      assert.equal(report.records.length, 30);
      check("created-30-profiles");
    }
    if (phase === "workflows") {
      assert.equal(report.records.length, 30);
      const statuses = (await api("/list_status_cv/")).filter(
        (s) => s.is_active !== false,
      );
      report.statuses = statuses.map(({ id, name }) => ({ id, name }));
      await eachRecord(report.records, async (row) => {
        owned(row.id);
        if (!checked("update-readback-" + row.index)) {
          const read = await detail(row),
            values = {};
          for (const key of [
            "first_name",
            "birthday",
            "gender",
            "numberphone",
            "city_code",
            "district_code",
            "address",
            "email",
            "education_level",
            "education_major",
            "language_skill",
            "application_date",
            "candidate_source",
          ])
            if (read[key] !== null && read[key] !== undefined)
              values[key] = read[key];
          values.address = report.prefix + " UPDATED " + row.index;
          values.language_skill = "TEST UPDATED English";
          values.ls_user_received = [report.account.id];
          await api("/detail_cv/" + row.id, {
            method: "PUT",
            multipart: multipart(values),
          });
          const updated = await detail(row);
          assert.equal(updated.address, values.address);
          assert.equal(updated.language_skill, values.language_skill);
          check("update-readback-" + row.index, { recordId: row.id });
        }
        if (!checked("status-readback-" + row.index)) {
          const target = statuses[(row.index - 1) % statuses.length];
          await api("/change_status_cv/" + row.id, {
            method: "PUT",
            multipart: {
              code_cv: row.code,
              cv_status: String(target.id),
              why_change: report.prefix + " TEST status " + target.name,
            },
          });
          const read = await detail(row);
          assert.equal(Number(read.cv_status_id ?? read.cv_status), target.id);
          row.status = target.name;
          save();
          check("status-readback-" + row.index, {
            recordId: row.id,
            status: target.name,
          });
        }
        if (!checked("note-file-readback-" + row.index)) {
          const file = attachment(row.index),
            note = report.prefix + " Ghi chú " + row.index;
          await api("/note-cv/", {
            method: "POST",
            multipart: {
              ...multipart({ note }, file, "file_note"),
              id_cv: String(row.id),
            },
          });
          const notes = await api("/note-cv/" + row.id);
          const persisted = notes.find((n) => (n.content ?? n.note) === note);
          assert(persisted, "New note missing");
          assert(persisted.data_file?.length > 0, "Note attachment missing");
          const download = await context.request.get(
            base + "/api/download-note-cv/" + persisted.data_file[0].id,
            { headers: { Authorization: "Bearer " + token } },
          );
          assert(download.ok());
          assert.equal(
            crypto
              .createHash("sha256")
              .update(await download.body())
              .digest("hex"),
            row.file.sha256,
          );
          check("note-file-readback-" + row.index, {
            recordId: row.id,
            notes: notes.length,
            downloadBytes: file.buffer.length,
          });
        }
      });
      if (!report.interview) {
        const date = new Date();
        date.setDate(date.getDate() + 35);
        const day = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(date);
        await api("/regis-interview/", {
          method: "POST",
          multipart: multipart({
            title: report.prefix + " Interview",
            start_date: day,
            time_start: "09:00",
            time_end: "17:00",
            note: report.prefix + " TEST calendar",
          }),
        });
        const calendar = await api(
          "/list-interview/?from_date=" + day + "&to_date=" + day,
        );
        const interview = calendar.results.find(
          (r) => r.title === report.prefix + " Interview",
        );
        assert(interview);
        report.interview = {
          id: interview.id_interview ?? interview.id,
          day,
          title: interview.title,
        };
        save();
        check("calendar-create-readback", report.interview);
      }
      const interview = report.interview;
      assert(interview.title.startsWith(report.prefix));
      if (!checked("attach-30-readback")) {
        await api("/add-cv-interview/", {
          method: "POST",
          multipart: {
            ls_id_cv: JSON.stringify(report.records.map((r) => r.id)),
            id_interview: String(interview.id),
          },
        });
        const code = await api("/check-cv-interview/" + interview.id);
        assert(code.code_interview);
        interview.code = code.code_interview;
        save();
        const data = await api(
          "/regis-interview/" + encodeURIComponent(interview.code),
        );
        assert.equal(data[0].ls_cv_interview.length, 30);
        check("attach-30-readback", { count: 30, code: interview.code });
      }
      await eachRecord(report.records, async (row) => {
        if (checked("time-readback-" + row.index)) return;
        owned(row.id);
        const minutes = 9 * 60 + (row.index - 1) * 15,
          time =
            String(Math.floor(minutes / 60)).padStart(2, "0") +
            ":" +
            String(minutes % 60).padStart(2, "0");
        await api("/detail-cv-interview/", {
          method: "POST",
          data: { id_cv: row.id, id_interview: interview.id, time_start: time },
        });
        row.interviewTime = time;
        save();
        check("time-write-" + row.index, { recordId: row.id, time });
      });
      const data = await api(
        "/regis-interview/" + encodeURIComponent(interview.code),
      );
      fs.writeFileSync(
        "/tmp/ticket-qc30-interview-readback.json",
        JSON.stringify(data, null, 2),
      );
      for (const row of report.records) {
        const member = data[0].ls_cv_interview.find((r) => r.id === row.id);
        assert(member);
        const time = String(
          member.data_interview_cv?.time_start ??
            member.time_start ??
            member.day_start ??
            "",
        ).slice(0, 5);
        assert.equal(time, row.interviewTime);
        check("time-readback-" + row.index, { recordId: row.id, time });
      }
      const finalRows = (await list()).results;
      await eachRecord(report.records, async (row) => {
        const current = finalRows.find((item) => item.id === row.id);
        const target = statuses[(row.index - 1) % statuses.length];
        assert(current);
        if (Number(current.cv_status_id) !== target.id) {
          owned(row.id);
          await api("/change_status_cv/" + row.id, {
            method: "PUT",
            multipart: {
              code_cv: row.code,
              cv_status: String(target.id),
              why_change: report.prefix + " final status " + target.name,
            },
          });
        }
        const persisted = await detail(row);
        assert.equal(
          Number(persisted.cv_status_id ?? persisted.cv_status),
          target.id,
        );
        check("final-status-readback-" + row.index, {
          recordId: row.id,
          status: target.name,
        });
      });
      check("all-30-workflows-read-back");
    }
    if (phase === "edges") {
      if (!checked("delete-profile-readback")) {
        const source = await detail(report.records[0]);
        const scratchName = report.prefix + " DELETE_CONTROL";
        let scratch = (await list()).results.find(
          (row) => row.first_name === scratchName,
        );
        if (!scratch) {
          const values = Object.fromEntries(
            [
              "birthday",
              "gender",
              "numberphone",
              "city_code",
              "district_code",
              "address",
              "email",
            ].map((key) => [key, source[key]]),
          );
          values.first_name = scratchName;
          const parent = (await api("/detail_recruitment/" + report.parent.id))
            .results;
          values.department_recruited = parent.department_recruited;
          await api("/detail_cv/" + report.parent.id, {
            method: "POST",
            multipart: multipart(values, attachment(1)),
          });
          scratch = (await list()).results.find(
            (row) => row.first_name === scratchName,
          );
        }
        assert(scratch && scratch.first_name === scratchName);
        report.deletionControl = { id: scratch.id, name: scratchName };
        save();
        const duplicates = await api("/check-cv/" + scratch.id);
        assert(
          JSON.stringify(duplicates).includes(report.records[0].name),
          "Expected duplicate profile missing",
        );
        check("duplicate-positive-readback", { recordId: scratch.id });
        const before = (await api("/detail_cv/" + scratch.id)).results;
        await api("/del-file-cv/", {
          method: "POST",
          multipart: {
            id_cv: String(scratch.id),
            name_file_cv: before.name_file_cv,
          },
        });
        assert(!(await api("/detail_cv/" + scratch.id)).results.name_file_cv);
        check("delete-file-preserves-profile", { recordId: scratch.id });
        await api("/add-cv-interview/", {
          method: "POST",
          multipart: {
            ls_id_cv: JSON.stringify([scratch.id]),
            id_interview: String(report.interview.id),
          },
        });
        let members = (
          await api(
            "/regis-interview/" + encodeURIComponent(report.interview.code),
          )
        )[0].ls_cv_interview;
        assert.equal(members.length, 31);
        await api(
          "/del-cv-interview/?" +
            new URLSearchParams({
              ls_id_cv: JSON.stringify([scratch.id]),
              code_interview: report.interview.code,
            }),
          { method: "DELETE" },
        );
        members = (
          await api(
            "/regis-interview/" + encodeURIComponent(report.interview.code),
          )
        )[0].ls_cv_interview;
        assert.equal(members.length, 30);
        assert(!members.some((row) => row.id === scratch.id));
        assert(
          (await api("/detail_cv/" + scratch.id)).results.id === scratch.id,
        );
        check("remove-member-preserves-profile", {
          recordId: scratch.id,
          remainingMembers: 30,
        });
        await api("/del-data-cv/", {
          method: "POST",
          data: { id_cv: scratch.id },
        });
        assert(!(await list()).results.some((row) => row.id === scratch.id));
        report.deletionControl.deleted = true;
        save();
        check("delete-profile-readback", { recordId: scratch.id });
      }
      const title = report.prefix + " DELETE_CALENDAR",
        day = report.interview.day;
      let calendar = await api(
        "/list-interview/?from_date=" + day + "&to_date=" + day,
      );
      let temporary = calendar.results.find((row) => row.title === title);
      if (!temporary) {
        await api("/regis-interview/", {
          method: "POST",
          multipart: multipart({
            title,
            start_date: day,
            time_start: "17:00",
            time_end: "18:00",
            note: report.prefix + " TEMP",
          }),
        });
        calendar = await api(
          "/list-interview/?from_date=" + day + "&to_date=" + day,
        );
        temporary = calendar.results.find((row) => row.title === title);
      }
      assert(temporary && temporary.title.startsWith(report.prefix));
      const id = temporary.id_interview ?? temporary.id;
      await api("/regis-interview/", {
        method: "PUT",
        multipart: multipart({
          id_interview: id,
          title,
          start_date: day,
          time_start: "17:00",
          time_end: "18:30",
          note: report.prefix + " UPDATED calendar",
        }),
      });
      calendar = await api(
        "/list-interview/?from_date=" + day + "&to_date=" + day,
      );
      const persisted = calendar.results.find(
        (row) => (row.id_interview ?? row.id) === id,
      );
      const actual = String(persisted.time_end).slice(0, 5);
      if (
        actual === "18:30" &&
        persisted.note === report.prefix + " UPDATED calendar"
      )
        check("calendar-update-readback", { recordId: id });
      else {
        const issue = {
          name: "calendar-update-readback",
          result: "failed",
          layer: "backend",
          endpoint: "PUT /api/regis-interview/",
          httpStatus: 200,
          recordId: id,
          expected: {
            time_end: "18:30",
            note: report.prefix + " UPDATED calendar",
          },
          actual: { time_end: actual, note: persisted.note },
        };
        recordCheck(issue);
      }
      await api("/regis-interview/" + id, { method: "DELETE" });
      calendar = await api(
        "/list-interview/?from_date=" + day + "&to_date=" + day,
      );
      assert(
        !calendar.results.some((row) => (row.id_interview ?? row.id) === id),
      );
      check("calendar-delete-readback", { recordId: id });
      assert.equal(
        (await list()).results.filter((row) =>
          row.first_name.startsWith(report.prefix),
        ).length,
        30,
      );
      check("destructive-controls-cleaned-30-profiles-preserved");
    }
    if (phase === "ui") {
      await page.goto(
        base +
          "/recruitment/candidates?from_date=2020-01-01&to_date=2027-12-31&page_size=100&search=" +
          report.prefix,
      );
      await waitList();
      const table = page.getByRole("table", {
        name: "Bảng ứng viên",
        exact: true,
      });
      await table.waitFor();
      assert.equal(await table.locator("tbody tr").count(), 30);
      check("ui-30-candidate-rows");
      if (!checked("ui-candidate-export")) {
        const pending = page.waitForEvent("download");
        await page
          .getByRole("button", { name: "Xuất Excel", exact: true })
          .click();
        const file = await pending;
        assert.equal(await file.failure(), null);
        assert(fs.statSync(await file.path()).size > 0);
        check("ui-candidate-export");
      }
      for (const row of report.records) {
        if (checked("ui-profile-" + row.index)) continue;
        const dialog = await openAction(row, "Sửa hồ sơ", "Chi tiết ứng viên");
        await dialog.locator("#recruitment-first_name").waitFor();
        assert.equal(
          await dialog.locator("#recruitment-first_name").inputValue(),
          row.name,
        );
        assert.equal(
          await dialog.locator("#recruitment-address").inputValue(),
          report.prefix + " UPDATED " + row.index,
        );
        assert(await dialog.locator("#recruitment-cv_status").isDisabled());
        if (row.index <= 7) {
          await dialog
            .locator('section[aria-label="Tệp CV"]')
            .getByRole("button", { name: row.file.name, exact: true })
            .click();
          const preview = page.getByRole("dialog", {
            name: row.file.name,
            exact: true,
          });
          await preview.waitFor();
          await preview.getByRole("button", { name: /^Đóng xem/ }).click();
          check("ui-cv-preview-" + row.index, { file: row.file.name });
        }
        await closeDialog("Chi tiết ứng viên");
        await closeDialog("Chọn thao tác");
        check("ui-profile-" + row.index, { recordId: row.id });
      }
      for (const row of report.records.slice(0, 7)) {
        if (checked("ui-history-preview-" + row.index)) continue;
        const note = await openAction(row, "Ghi chú", "Ghi chú phỏng vấn");
        await note
          .getByRole("button", {
            name: new RegExp(
              "^(Xem ảnh|Mở tệp) " +
                row.file.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
                "$",
            ),
          })
          .click();
        const preview = page.getByRole("dialog", {
          name: row.file.name,
          exact: true,
        });
        await preview.waitFor();
        await preview.getByRole("button", { name: /^Đóng xem/ }).click();
        await closeDialog("Ghi chú phỏng vấn");
        await closeDialog("Chọn thao tác");
        check("ui-history-preview-" + row.index, { file: row.file.name });
      }
      if (!checked("ui-note-stays-open-no-table-remount-no-jump")) {
        const row = report.records[0];
        const node = await table.elementHandle();
        const note = await openAction(row, "Ghi chú", "Ghi chú phỏng vấn");
        const text = note.getByRole("textbox", {
          name: "Ghi chú phỏng vấn",
          exact: true,
        });
        await text.fill(report.prefix + " live UI note");
        const before = await note.boundingBox();
        const response = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/api/note-cv/" &&
            r.request().method() === "POST",
        );
        await note
          .getByRole("button", { name: "Thêm ghi chú", exact: true })
          .click();
        assert((await response).ok());
        await note
          .getByText(report.prefix + " live UI note", { exact: true })
          .first()
          .waitFor();
        await page.waitForFunction(
          () => document.getElementById("recruitment-note")?.value === "",
        );
        assert.equal(await text.inputValue(), "");
        assert(await node.evaluate((n) => n.isConnected));
        assert.equal((await note.boundingBox()).y, before.y);
        check("ui-note-stays-open-no-table-remount-no-jump");
        await closeDialog("Ghi chú phỏng vấn");
        await closeDialog("Chọn thao tác");
      }
      await page.goto(
        base +
          "/recruitment/interviews/" +
          encodeURIComponent(report.interview.code),
      );
      const members = page.getByRole("table", {
        name: "CV phỏng vấn",
        exact: true,
      });
      await members.waitFor();
      assert.equal(await members.locator("tbody tr").count(), 30);
      check("ui-30-interview-members");
      await page.goto(base + "/recruitment/interviews");
      await page.getByRole("grid", { name: "Lịch phỏng vấn" }).waitFor();
      for (const view of ["Tháng", "Ngày", "Tuần"]) {
        await page.getByRole("button", { name: view, exact: true }).click();
        await page.getByRole("grid", { name: "Lịch phỏng vấn" }).waitFor();
        check("ui-calendar-" + view);
      }
      await page.goto(
        base +
          "/recruitment/requests?from_date=2020-01-01&to_date=2027-12-31&page_size=100",
      );
      await page
        .getByRole("table", { name: "Bảng yêu cầu tuyển dụng", exact: true })
        .waitFor();
      await page
        .getByRole("button", {
          name: "Thao tác " + report.parent.code,
          exact: true,
        })
        .first()
        .click();
      await page
        .getByRole("dialog", { name: "Chọn thao tác", exact: true })
        .getByRole("button", {
          name: "Xem yêu cầu " + report.parent.code,
          exact: true,
        })
        .click();
      const requestDialog = page.getByRole("dialog", {
        name: "Chi tiết yêu cầu tuyển dụng",
        exact: true,
      });
      await requestDialog.locator("#recruitment-ticket_code").waitFor();
      assert(
        await requestDialog.locator("#recruitment-ticket_code").isDisabled(),
      );
      assert(await requestDialog.locator("#recruitment-title").isDisabled());
      assert(
        !(await requestDialog.locator("#recruitment-quantity").isDisabled()),
      );
      await closeDialog("Chi tiết yêu cầu tuyển dụng");
      await closeDialog("Chọn thao tác");
      check("ui-request-detail-field-ownership");
      const requestExport = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Xuất Excel", exact: true })
        .click();
      const requestFile = await requestExport;
      assert.equal(await requestFile.failure(), null);
      assert(fs.statSync(await requestFile.path()).size > 0);
      check("ui-request-export");
      await page.goto(base + "/recruitment/reports");
      await page
        .getByRole("table", { name: "Bảng báo cáo tuyển dụng" })
        .waitFor();
      for (const tab of await page.getByRole("tab").all()) {
        await tab.click();
        const table = page.getByRole("table", {
          name: "Bảng báo cáo tuyển dụng",
          exact: true,
        });
        const empty = page.getByText(
          "Không có dữ liệu báo cáo trong khoảng thời gian đã chọn.",
          { exact: true },
        );
        await table.or(empty).waitFor();
        check("ui-report-" + (await tab.innerText()), {
          state: (await empty.isVisible()) ? "empty" : "table",
        });
      }
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Xuất Excel", exact: true })
        .click();
      const file = await download;
      assert.equal(await file.failure(), null);
      assert(fs.statSync(await file.path()).size > 0);
      check("ui-report-export");
      for (const width of [1600, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.locator("main").evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        const mainBounds = await page.locator("main").boundingBox();
        const panelBounds = await page.getByRole("tabpanel").boundingBox();
        const gap =
          mainBounds.y + mainBounds.height - panelBounds.y - panelBounds.height;
        assert(gap >= 20, "Report bottom spacing missing");
        check("ui-report-bottom-spacing-" + width, { pixels: gap });
        await page.screenshot({
          path: "/tmp/ticket-qc30-reports-" + width + ".png",
        });
        check("ui-report-width-" + width);
      }
      assert.deepEqual(report.errors, []);
      check("live-ui-complete");
    }
    if (report.failure?.phase === phase) {
      report.resolvedAttempts ??= [];
      report.resolvedAttempts.push(report.failure);
      delete report.failure;
    }
    report.lastCompletedPhase = phase;
    if (phase === "ui") {
      report.summary = {
        result: report.checks.some((check) => check.result === "failed")
          ? "completed-with-backend-issues"
          : "passed",
        profiles: report.records.length,
        checksPassed: new Set(
          report.checks
            .filter((check) => check.result === "passed")
            .map((check) => check.name),
        ).size,
        openIssues: report.checks.filter((check) => check.result === "failed"),
        pageErrors: report.errors.length,
      };
      console.log(JSON.stringify(report.summary));
      if (report.summary.openIssues.length) process.exitCode = 1;
    }
    save();
  } catch (error) {
    report.failure = { phase, message: error.message };
    save();
    await page
      .screenshot({ path: "/tmp/ticket-qc30-failure.png" })
      .catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
