const ticketTestEnv = require("../env.cjs");
// Real browser UI QC; credentials arrive through stdin. Resume reuses TEST records.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = ticketTestEnv.baseUrl;
const path =
  process.env.RECRUITMENT_REPORT ||
  "tests/artifacts/ticket-recruitment-workflows.json";
const report = fs.existsSync(path)
  ? JSON.parse(fs.readFileSync(path, "utf8"))
  : {
      prefix: "TEST_REC_261021",
      candidateName: "TEST QC Recruitment 261021",
      interviewTitle: "TEST QC Interview 261021",
      checks: [],
    };
const save = () =>
  fs.writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
const log = (step, data = {}) => console.log(JSON.stringify({ step, ...data }));
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  const writes = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.route("**/api/**", (route) => {
      const request = route.request(),
        pathname = new URL(request.url()).pathname;
      if (
        ["GET", "HEAD", "OPTIONS"].includes(request.method()) ||
        ["/api/token/", "/api/token/refresh/"].includes(pathname)
      )
        return route.continue();
      const allowed = [
        "/api/detail_cv/",
        "/api/change_status_cv/",
        "/api/regis-interview/",
        "/api/add-cv-interview/",
        "/api/note-cv/",
        "/api/detail-cv-interview/",
        "/api/del-cv-interview/",
        "/api/del-file-cv/",
        "/api/del-data-cv/",
        "/api/export-recruitment/",
        "/api/export-cv/",
        "/api/export_rect/",
      ].some((prefix) => pathname.startsWith(prefix));
      assert(allowed, "Unexpected mutation " + pathname);
      writes.push({ method: request.method(), path: pathname });
      return route.continue();
    });
    await page.goto(base + "/login");
    await page.locator("#login-username").fill(credentials.username);
    await page.locator("#login-password").fill(credentials.password);
    await page
      .getByRole("button", { name: "Sign In to Ticket", exact: true })
      .click();
    await page.waitForURL((url) => url.pathname !== "/login");
    async function choose(label, name) {
      await page
        .getByRole("dialog")
        .getByRole("combobox", { name: label, exact: true })
        .click();
      if (name) await page.getByRole("option", { name, exact: true }).click();
      else
        await page
          .getByRole("option")
          .filter({ hasNotText: "Không chọn" })
          .first()
          .click();
    }
    async function submit(endpoint, method = "POST") {
      const response = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === endpoint &&
          r.request().method() === method,
      );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Lưu", exact: true })
        .click();
      const result = await response;
      let body;
      try {
        body = await result.json();
      } catch {
        body = {};
      }
      if (
        endpoint === "/api/add-cv-interview/" &&
        result.status() === 400 &&
        body.message === "Trùng CV trong lịch phỏng vấn."
      ) {
        await page
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        return body;
      }
      assert(
        result.ok(),
        `${endpoint} returned ${result.status()}: ${JSON.stringify(body)}`,
      );
      assert(!body.error, JSON.stringify(body));
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      return body;
    }
    async function candidates() {
      const response = page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/api/list_cv/",
      );
      await page.goto(
        base +
          "/recruitment/candidates?from_date=2020-01-01&to_date=2026-10-21&page_size=100",
      );
      const data = await (await response).json();
      await page
        .locator('section[aria-label="Danh sách ứng viên"][aria-busy="false"]')
        .waitFor();
      return data.results.find(
        (row) => row.first_name === report.candidateName,
      );
    }
    let candidate = await candidates();
    if (!candidate) {
      await page.goto(
        base + "/recruitment/requests?from_date=2026-01-01&to_date=2026-04-20",
      );
      const add = page.getByRole("button", { name: /^Thêm ứng viên / }).nth(1);
      await add.waitFor();
      await add.click();
      await page.locator("#recruitment-first_name").waitFor();
      const initialWrites = writes.length;
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Lưu", exact: true })
        .click();
      await page
        .getByText("Vui lòng nhập họ và tên.", { exact: true })
        .waitFor();
      assert.equal(writes.length, initialWrites);
      await page.locator("#recruitment-first_name").fill(report.candidateName);
      await page
        .getByText("Vui lòng nhập họ và tên.", { exact: true })
        .waitFor({ state: "hidden" });
      await page.locator("#recruitment-numberphone").fill("0900000000");
      await page
        .locator("#recruitment-email")
        .fill("test-recruitment-261021@example.invalid");
      await choose("Tỉnh/Thành phố");
      await page.locator("#recruitment-birthday").fill("01/01/2000");
      await page.locator("#recruitment-address").fill("TEST QC address");
      await page.locator("#recruitment-language_skill").fill("TEST English");
      await page.locator("#recruitment-education_major").fill("TEST QC");
      await choose("Quận/Huyện");
      await choose("Trình độ học vấn");
      await choose("Nguồn ứng viên");
      await page
        .locator("#recruitment-note")
        .fill("TEST QC candidate creation");
      await page.locator("#recruitment-file_upload").setInputFiles({
        name: "TEST_CV_261021.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(
          "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
        ),
      });
      const request = page.waitForResponse(
        (r) =>
          /\/api\/detail_cv\/\d+$/.test(new URL(r.url()).pathname) &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Lưu", exact: true })
        .click();
      const created = await request;
      const requestBody = created.request().postData();
      const valuesPart = requestBody?.match(
        /name="values"\r\n\r\n([\s\S]*?)\r\n--/,
      );
      if (valuesPart) report.candidateRequestValues = JSON.parse(valuesPart[1]);
      const body = await created.json();
      assert(
        created.ok() && !body.error,
        JSON.stringify({ status: created.status(), body }),
      );
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      candidate = await candidates();
    }
    assert(
      candidate && candidate.first_name === report.candidateName,
      "TEST candidate not visible on readback",
    );
    report.candidate = { id: candidate.id, code: candidate.code_cv };
    save();
    log("candidate-created-readback", report.candidate);
    await page
      .getByRole("button", {
        name: `Sửa hồ sơ ${candidate.code_cv}`,
        exact: true,
      })
      .click();
    await page.locator("#recruitment-first_name").waitFor();
    await page
      .locator("#recruitment-note")
      .fill("TEST QC: updated candidate via browser UI.");
    await submit(`/api/detail_cv/${candidate.id}`, "PUT");
    report.checks.push({
      case: "Create, validate and edit TEST candidate with file",
      result: "passed",
    });
    save();
    log("candidate-edited");
    if (candidate.cv_status_id !== 2) {
      await page
        .getByRole("button", {
          name: `Chuyển trạng thái ${candidate.code_cv}`,
          exact: true,
        })
        .click();
      await page.getByRole("dialog").waitFor();
      await choose("Trạng thái", "Chờ phỏng vấn");
      await page
        .locator("#recruitment-why_change")
        .fill("TEST QC status transition");
      await submit(`/api/change_status_cv/${candidate.id}`, "PUT");
      report.checks.push({ case: "Change CV status", result: "passed" });
      save();
      log("status-changed");
    }
    await page
      .getByRole("button", {
        name: `Kiểm tra trùng ${candidate.code_cv}`,
        exact: true,
      })
      .click();
    await page.getByRole("dialog").waitFor();
    await page
      .getByText("Đang tải thông tin...", { exact: true })
      .waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    report.checks.push({ case: "Check duplicate profiles", result: "passed" });
    save();
    await page.goto(base + "/recruitment/interviews");
    await page.getByRole("grid", { name: "Lịch phỏng vấn" }).waitFor();
    await page.waitForLoadState("networkidle");
    const existingSchedule = page.getByRole("button", {
      name: `Sửa lịch ${report.interviewTitle}`,
      exact: true,
    });
    if ((await existingSchedule.count()) === 0) {
      await page
        .getByRole("button", { name: "Tạo lịch phỏng vấn", exact: true })
        .click();
      await page.locator("#recruitment-title").waitFor();
      await page.locator("#recruitment-title").fill(report.interviewTitle);
      await page.locator("#recruitment-start_date").fill("22/10/2026");
      await page.locator("#recruitment-time_start").fill("10:00");
      await page.locator("#recruitment-time_end").fill("09:00");
      const initialWrites = writes.length;
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Lưu", exact: true })
        .click();
      await page
        .getByText("Giờ kết thúc phải sau giờ bắt đầu.", { exact: true })
        .waitFor();
      assert.equal(writes.length, initialWrites);
      await page.locator("#recruitment-time_end").fill("11:00");
      await page
        .getByText("Giờ kết thúc phải sau giờ bắt đầu.", { exact: true })
        .waitFor({ state: "hidden" });
      await page
        .locator("#recruitment-note")
        .fill("TEST QC no real interviewers invited");
      await submit("/api/regis-interview/");
      await page
        .getByRole("button", {
          name: `Sửa lịch ${report.interviewTitle}`,
          exact: true,
        })
        .waitFor();
      report.checks.push({
        case: "Create interview and reject reversed times",
        result: "passed",
      });
      save();
      log("interview-created");
    } else {
      log("reuse-interview");
    }
    const listResponse = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/list-interview/",
    );
    await page.reload();
    const schedules = await (await listResponse).json();
    const schedule = schedules.results.find(
      (row) => row.title === report.interviewTitle,
    );
    assert(schedule, "Created interview missing on reload");
    report.interview = {
      id: schedule.id_interview ?? schedule.id,
      startDate: schedule.start_date,
    };
    save();
    await page
      .getByRole("button", {
        name: `Sửa lịch ${report.interviewTitle}`,
        exact: true,
      })
      .click();
    await page.locator("#recruitment-title").waitFor();
    await page.locator("#recruitment-note").fill("TEST QC interview updated");
    await submit("/api/regis-interview/", "PUT");
    report.checks.push({
      case: "Edit interview and reload persisted schedule",
      result: "passed",
    });
    save();
    await candidates();
    await page
      .getByRole("button", {
        name: `Gắn lịch phỏng vấn ${candidate.code_cv}`,
        exact: true,
      })
      .click();
    await page.locator("#recruitment-start_date").waitFor();
    await page.locator("#recruitment-start_date").fill("22/10/2026");
    await choose(
      "Lịch phỏng vấn",
      `${report.interviewTitle} (10:00:00 - 11:00:00)`,
    );
    await submit("/api/add-cv-interview/");
    report.checks.push({
      case: "Attach candidate to interview",
      result: "passed",
    });
    save();
    log("candidate-attached");
    await page.goto(base + "/recruitment/interviews");
    await page
      .getByRole("button", {
        name: `Xem CV lịch ${report.interviewTitle}`,
        exact: true,
      })
      .click();
    await page.waitForURL(/\/recruitment\/interviews\/[^/]+$/);
    await page.getByRole("table", { name: "CV phỏng vấn" }).waitFor();
    await page
      .getByRole("button", {
        name: `Ghi chú ${report.candidateName}`,
        exact: true,
      })
      .click();
    await page.locator("#recruitment-note").waitFor();
    await page.locator("#recruitment-note").fill("TEST QC interview feedback");
    await page.locator("#recruitment-file_note").setInputFiles({
      name: "TEST_interview_feedback.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n% TEST recruitment feedback\n%%EOF"),
    });
    await submit("/api/note-cv/");
    report.checks.push({
      case: "View assigned CV and add interview feedback",
      result: "passed",
    });
    save();
    log("interview-feedback-saved");
    await page
      .getByRole("button", {
        name: `Đặt giờ ${report.candidateName}`,
        exact: true,
      })
      .click();
    await page.locator("#recruitment-time_start").fill("10:15");
    await submit("/api/detail-cv-interview/");
    await page.getByText("10:15", { exact: true }).waitFor();
    report.checks.push({
      case: "Set candidate interview time and read back",
      result: "passed",
    });
    await page
      .getByRole("button", {
        name: `Xem hồ sơ ${report.candidateName}`,
        exact: true,
      })
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
    await page
      .getByText("TEST QC interview feedback", { exact: true })
      .first()
      .waitFor();
    const noteDownload = page.waitForEvent("download");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "TEST_interview_feedback.pdf", exact: true })
      .first()
      .click();
    const noteFile = await noteDownload;
    assert.equal(await noteFile.failure(), null);
    assert(fs.statSync(await noteFile.path()).size > 0);
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    report.checks.push({
      case: "Read-only candidate detail and persisted feedback",
      result: "passed",
    });
    await page
      .getByRole("button", {
        name: `Bỏ khỏi lịch ${report.candidateName}`,
        exact: true,
      })
      .click();
    await submit("/api/del-cv-interview/", "DELETE");
    await page
      .getByText("Không có ứng viên trong lịch phỏng vấn.", { exact: true })
      .waitFor();
    report.checks.push({
      case: "Remove TEST candidate from interview",
      result: "passed",
    });
    const candidateList = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/list_cv/",
    );
    await page.goto(
      base +
        "/recruitment/candidates?from_date=2020-01-01&to_date=2026-10-21&page_size=100",
    );
    const boundaryRows = (await (await candidateList).json()).results.filter(
      (row) =>
        /^TEST QC Missing (Source|Education) 261021$/.test(row.first_name),
    );
    for (const boundary of boundaryRows) {
      assert(boundary.id !== report.candidate.id);
      const deleteFile = page.getByRole("button", {
        name: `Xóa tệp CV ${boundary.code_cv}`,
        exact: true,
      });
      if (await deleteFile.count()) {
        await deleteFile.click();
        await submit("/api/del-file-cv/");
        await deleteFile.waitFor({ state: "hidden" });
      }
      await page
        .getByRole("button", {
          name: `Xóa hồ sơ ${boundary.code_cv}`,
          exact: true,
        })
        .click();
      await submit("/api/del-data-cv/");
      await page
        .getByRole("button", {
          name: `Sửa hồ sơ ${boundary.code_cv}`,
          exact: true,
        })
        .waitFor({ state: "hidden" });
    }
    report.checks.push({
      case: "Delete TEST attachments and boundary candidate records",
      result: "passed",
      ids: boundaryRows.map((row) => row.id),
    });
    for (const [section, label] of [
      ["requests", "Yêu cầu"],
      ["candidates", "Ứng viên"],
    ]) {
      await page.goto(
        base +
          `/recruitment/${section}?from_date=2020-01-01&to_date=2026-10-21`,
      );
      await page.getByRole("table").waitFor();
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Xuất Excel", exact: true })
        .click();
      const file = await download;
      assert.equal(await file.failure(), null);
      assert(fs.statSync(await file.path()).size > 0);
      report.checks.push({
        case: `Export ${label} Excel with applied filters`,
        result: "passed",
      });
    }
    await candidates();
    await page
      .getByRole("button", {
        name: `Gắn lịch phỏng vấn ${candidate.code_cv}`,
        exact: true,
      })
      .click();
    await page.locator("#recruitment-start_date").fill("22/10/2026");
    await choose(
      "Lịch phỏng vấn",
      `${report.interviewTitle} (10:00:00 - 11:00:00)`,
    );
    await submit("/api/add-cv-interview/");
    report.finalState =
      "Primary TEST candidate retained and attached to TEST interview; auxiliary candidates removed.";
    report.pageErrors = errors;
    assert.deepEqual(errors, []);
    report.writes = writes;
    report.result = "passed";
    report.checks = [
      ...new Map(report.checks.map((check) => [check.case, check])).values(),
    ];
    delete report.failure;
    save();
    log("complete", { report: path });
  } catch (error) {
    report.result = "failed";
    report.failure = error.message;
    save();
    await page.screenshot({
      path: "/tmp/ticket-recruitment-workflow-failure.png",
      animations: "disabled",
    });
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
