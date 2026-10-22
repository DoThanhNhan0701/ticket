const ticketTestEnv = require("../env.cjs");
// Live UI-only recruitment QC. Credentials via stdin; all writes are restricted to this run's TEST records.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = ticketTestEnv.baseUrl;
const artifact =
  process.env.QC_REPORT || "tests/artifacts/ticket-recruitment-20-records.json";
const phase = process.env.QC_PHASE || "create";
const prefix = "TEST_REC20_261021";
const today = "2026-10-21";
const report = fs.existsSync(artifact)
  ? JSON.parse(fs.readFileSync(artifact, "utf8"))
  : {
      prefix,
      date: today,
      method:
        "Real browser UI only; live API responses observed, never mocked. Mutations restricted to this run's TEST records.",
      records: [],
      checks: [],
      writes: [],
      pageErrors: [],
      issues: [],
      phases: {},
    };
const save = () =>
  fs.writeFileSync(artifact, JSON.stringify(report, null, 2) + "\n");
function check(id, result, details = {}) {
  const { id: recordId, ...rest } = details;
  const entry = { id, result, ...rest, ...(recordId ? { recordId } : {}) };
  const index = report.checks.findIndex((item) => item.id === id);
  if (index < 0) report.checks.push(entry);
  else report.checks[index] = entry;
  save();
  console.log(JSON.stringify(entry));
}
function fixture(index) {
  const key = `${prefix}_${String(index).padStart(2, "0")}`;
  let name = key + " " + (index % 2 ? "Ứng viên Nam" : "Ứng viên Nữ");
  if (index === 5) name = (key + " ").padEnd(150, "Đ");
  let phone = "090000" + String(index).padStart(4, "0");
  if (index === 2) phone = "09000000002";
  if (index === 3) phone = "090000000003";
  if (index === 19) phone = "0900000001";
  if (index === 20) phone = "09000000002";
  const minimal = [1, 11].includes(index);
  let email = minimal ? "" : `qc20-${index}@example.invalid`;
  if (index === 6) email = "QC20+plus@example.invalid";
  if (index === 20) email = "qc20-2@example.invalid";
  let birthday = "01/01/2000";
  if (minimal) birthday = "";
  else if (index === 4) birthday = "29/02/2000";
  else if (index === 15) birthday = "20/10/2026";
  let note = `${key} tạo qua giao diện`;
  if (minimal) note = "";
  else if (index === 17) note = `${key} ` + "Nội_dung_TEST_".repeat(150);
  return {
    index,
    key,
    name,
    phone,
    email,
    minimal,
    gender: index % 2 ? "Nam" : "Nữ",
    file: ![1, 11].includes(index),
    birthday,
    education: !minimal && index !== 9,
    source: !minimal && index !== 10,
    note,
  };
}
function pdf(name, size) {
  const parts = ["%PDF-1.4\n"],
    offsets = [0];
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
    null,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  const content = `BT /F1 12 Tf 30 100 Td (${name}) Tj ET`;
  objects[3] = `<</Length ${Buffer.byteLength(content)}>>\nstream\n${content}\nendstream`;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(parts.join("")));
    parts.push(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
  }
  const xref = Buffer.byteLength(parts.join(""));
  parts.push(
    `xref\n0 6\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((value) => String(value).padStart(10, "0") + " 00000 n \n")
      .join("")}trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`,
  );
  const buffer = Buffer.from(parts.join(""));
  return size
    ? Buffer.concat([
        buffer,
        Buffer.alloc(Math.max(0, size - buffer.length), 32),
      ])
    : buffer;
}
const waitPath = (page, path, method = "GET") =>
  page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === path &&
      response.request().method() === method,
  );
function multipartValues(request) {
  const match = request
    .postData()
    ?.match(/name="values"\r\n\r\n([\s\S]*?)\r\n--/);
  return match ? JSON.parse(match[1]) : {};
}
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1050 },
    timezoneId: "Asia/Ho_Chi_Minh",
  });
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => {
    report.pageErrors.push({ phase, message: error.message });
    save();
  });
  await page.route("**/api/**", (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname,
      method = request.method();
    if (
      ["GET", "HEAD", "OPTIONS"].includes(method) ||
      ["/api/token/", "/api/token/refresh/"].includes(path)
    )
      return route.continue();
    const ids = new Set(report.records.map((row) => row.id));
    const schedules = new Set((report.interviews || []).map((row) => row.id));
    let allowed = false;
    if (/^\/api\/detail_cv\/\d+$/.test(path)) {
      const id = Number(path.split("/").pop());
      allowed =
        method === "POST"
          ? id === report.recruitment?.id &&
            String(multipartValues(request).first_name)
              .trim()
              .startsWith(prefix)
          : ids.has(id);
    } else if (/^\/api\/change_status_cv\/\d+$/.test(path))
      allowed = ids.has(Number(path.split("/").pop()));
    else if (path === "/api/regis-interview/") {
      const values = multipartValues(request);
      allowed =
        !values.user_interview?.length &&
        (method === "POST"
          ? String(values.title).startsWith(prefix)
          : schedules.has(Number(values.id_interview)));
    } else if (/^\/api\/regis-interview\/\d+$/.test(path))
      allowed = schedules.has(Number(path.split("/").pop()));
    else
      allowed = [
        "/api/add-cv-interview/",
        "/api/note-cv/",
        "/api/detail-cv-interview/",
        "/api/del-cv-interview/",
        "/api/del-file-cv/",
        "/api/del-data-cv/",
        "/api/export-recruitment/",
        "/api/export-cv/",
        "/api/export_rect/",
      ].includes(path);
    assert(allowed, `Unexpected mutation ${method} ${path}`);
    report.writes.push({ phase, method, path });
    save();
    return route.continue();
  });
  async function close() {
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  async function choose(label, name, index = 0) {
    await page
      .getByRole("dialog")
      .getByRole("combobox", { name: label, exact: true })
      .click();
    const item = name
      ? page.getByRole("option", { name, exact: true })
      : page
          .getByRole("option")
          .filter({ hasNotText: "Không chọn" })
          .nth(index);
    await item.waitFor();
    const labelText = await item.innerText();
    await item.click();
    return labelText;
  }
  async function submit(path, method, expected = 200) {
    const pending = waitPath(page, path, method);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Lưu", exact: true })
      .click();
    const response = await pending;
    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (response.status() !== expected) {
      report.lastFailure = {
        phase,
        path,
        method,
        status: response.status(),
        data,
        values: multipartValues(response.request()),
      };
      save();
      throw new Error(
        `${method} ${path}: ${response.status()} ${JSON.stringify(data)}`,
      );
    }
    if (response.ok() && !data.error)
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    return { response, data };
  }
  async function candidates(params = {}) {
    const query = new URLSearchParams({
      from_date: "2020-01-01",
      to_date: today,
      page_size: "100",
      search: prefix,
      ...params,
    });
    const pending = waitPath(page, "/api/list_cv/");
    await page.goto(`${base}/recruitment/candidates?${query}`);
    const response = await pending;
    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok()) return { status: response.status(), data };
    await page
      .locator('section[aria-label="Danh sách ứng viên"][aria-busy="false"]')
      .waitFor();
    return { status: response.status(), data };
  }
  async function requests() {
    const pending = waitPath(page, "/api/list_recruitment/");
    await page.goto(
      `${base}/recruitment/requests?from_date=2020-01-01&to_date=${today}&page_size=100`,
    );
    const data = await (await pending).json();
    await page
      .locator(
        'section[aria-label="Danh sách yêu cầu tuyển dụng"][aria-busy="false"]',
      )
      .waitFor();
    if (!report.recruitment) {
      const row = data.results.find((item) => item.id === 84);
      assert(row, "Required recruitment fixture is unavailable");
      report.recruitment = {
        id: row.id,
        code: row.ticket_code,
        note: "Existing recruitment request is read-only; only isolated TEST candidates are created under it.",
      };
      save();
    }
  }
  async function openCandidate(row, label = "Sửa hồ sơ") {
    assert(
      report.records.some((item) => item.id === row.id),
      "Not a run-owned TEST record",
    );
    await page
      .getByRole("button", { name: `${label} ${row.code}`, exact: true })
      .click();
    if (label === "Sửa hồ sơ")
      await page.locator("#recruitment-first_name").waitFor();
    else await page.getByRole("dialog").waitFor();
  }
  async function createRecords() {
    const listed = await candidates();
    if (listed.status === 500)
      check("empty-search-backend", "failed", {
        layer: "backend",
        status: 500,
        message:
          "No matching candidate search returns HTTP 500 instead of an empty list.",
      });
    const known = listed.data.results || [];
    for (let index = 1; index <= 20; index++) {
      const data = fixture(index);
      const persisted = report.records.find((row) => row.index === index);
      const existing = known.find((row) => row.first_name === data.name);
      if (persisted || existing) {
        if (!persisted)
          report.records.push({
            index,
            key: data.key,
            id: existing.id,
            code: existing.code_cv,
            name: existing.first_name,
            create: "reused",
          });
        save();
        continue;
      }
      await requests();
      await page
        .getByRole("button", {
          name: `Thêm ứng viên ${report.recruitment.code}`,
          exact: true,
        })
        .click();
      await page.locator("#recruitment-first_name").waitFor();
      if (index === 1) {
        const before = report.writes.length;
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Lưu", exact: true })
          .click();
        await page
          .getByText("Vui lòng nhập họ và tên.", { exact: true })
          .waitFor();
        assert.equal(report.writes.length, before);
        await page.locator("#recruitment-first_name").fill("AB");
        await page.getByText("Tối thiểu 3 ký tự.", { exact: true }).waitFor();
        await page.locator("#recruitment-numberphone").fill("abc");
        await page
          .getByText("Số điện thoại phải có từ 10 đến 12 chữ số.", {
            exact: true,
          })
          .waitFor();
        await page.locator("#recruitment-email").fill("invalid");
        await page.locator("#recruitment-birthday").fill("22/10/2026");
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Lưu", exact: true })
          .click();
        await page.getByText("Email không hợp lệ.", { exact: true }).waitFor();
        await page
          .getByText("Ngày sinh không được ở tương lai.", { exact: true })
          .waitFor();
        assert.equal(report.writes.length, before);
        await page.locator("#recruitment-email").fill("");
        await page.locator("#recruitment-birthday").fill("");
        check("create-invalid-fields-no-write", "passed", {
          cases: [
            "required",
            "name-too-short",
            "invalid-phone",
            "invalid-email",
            "future-birthday",
          ],
        });
      }
      await page
        .locator("#recruitment-first_name")
        .fill(index === 3 ? `  ${data.name}  ` : data.name);
      await page.locator("#recruitment-numberphone").fill(data.phone);
      if (data.gender === "Nữ") await choose("Giới tính", data.gender);
      await choose("Tỉnh/Thành phố", undefined, index === 4 ? 1 : 0);
      await choose("Quận/Huyện", undefined, index === 14 ? 1 : 0);
      if (data.birthday)
        await page.locator("#recruitment-birthday").fill(data.birthday);
      if (data.email)
        await page
          .locator("#recruitment-email")
          .fill(index === 18 ? `  ${data.email}  ` : data.email);
      if (data.minimal)
        await page
          .locator("#recruitment-address")
          .fill(`${data.key} TEST address`);
      if (!data.minimal) {
        await page
          .locator("#recruitment-address")
          .fill(`${data.key} Địa chỉ TEST`);
        await page.locator("#recruitment-education_major").fill("TEST QC");
        await page.locator("#recruitment-language_skill").fill("TEST English");
        if (data.education)
          await choose("Trình độ học vấn", undefined, index % 4);
        if (data.source) await choose("Nguồn ứng viên", undefined, index % 5);
        await page.locator("#recruitment-note").fill(data.note);
      }
      if ([12, 13].includes(index))
        await page
          .locator("#recruitment-application_date")
          .fill(index === 12 ? "01/01/2020" : "21/10/2026");
      if (index === 7) {
        await choose("Tỉnh/Thành phố", undefined, 1);
        assert(
          !(
            await page.locator("#recruitment-district_code").innerText()
          ).includes("Ba Đình"),
        );
        await choose("Quận/Huyện");
        check("city-change-resets-district", "passed");
      }
      let file;
      if (data.file) {
        const name =
          index === 16 ? "TEST CV tiếng Việt 261021.pdf" : `${data.key}.pdf`;
        const buffer = pdf(
          data.key,
          index === 8 ? 10 * 1024 * 1024 : undefined,
        );
        file = {
          name,
          bytes: buffer.length,
          sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
        };
        await page
          .locator("#recruitment-file_upload")
          .setInputFiles({ name, mimeType: "application/pdf", buffer });
      }
      let result;
      try {
        result = await submit(
          `/api/detail_cv/${report.recruitment.id}`,
          "POST",
        );
      } catch (error) {
        if (report.lastFailure?.status !== 400) throw error;
        check(`create-${index}-initial-rejection`, "failed", {
          layer: "backend-contract",
          status: 400,
          sent: report.lastFailure.values,
        });
        if (!data.minimal) throw error;
        const buffer = pdf(data.key);
        await page.locator("#recruitment-file_upload").setInputFiles({
          name: `${data.key}.pdf`,
          mimeType: "application/pdf",
          buffer,
        });
        file = {
          name: `${data.key}.pdf`,
          bytes: buffer.length,
          sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
        };
        const probes = [
          ["file_upload", async () => {}],
          [
            "birthday",
            async () =>
              page.locator("#recruitment-birthday").fill("01/01/2000"),
          ],
          [
            "email",
            async () =>
              page
                .locator("#recruitment-email")
                .fill(`qc20-${index}@example.invalid`),
          ],
          [
            "address",
            async () =>
              page
                .locator("#recruitment-address")
                .fill(`${data.key} TEST address`),
          ],
          ["education_level", async () => choose("Trình độ học vấn")],
          ["candidate_source", async () => choose("Nguồn ứng viên")],
          [
            "language_skill",
            async () =>
              page.locator("#recruitment-language_skill").fill("TEST English"),
          ],
          [
            "education_major",
            async () =>
              page.locator("#recruitment-education_major").fill("TEST QC"),
          ],
          [
            "note",
            async () =>
              page
                .locator("#recruitment-note")
                .fill(`${data.key} TEST minimal recovery`),
          ],
        ];
        for (const [field, fill] of probes) {
          await fill();
          try {
            result = await submit(
              `/api/detail_cv/${report.recruitment.id}`,
              "POST",
            );
            check(`minimal-${index}-accepted-after-${field}`, "passed", {
              observation:
                "Last field added in a progressive optional-field probe.",
              values: multipartValues(result.response.request()),
            });
            break;
          } catch (retryError) {
            if (report.lastFailure?.status !== 400) throw retryError;
            check(`minimal-${index}-rejected-after-${field}`, "failed", {
              layer: "backend-contract",
              status: 400,
              values: report.lastFailure.values,
            });
          }
        }
        if (!result) throw error;
      }
      const sent = multipartValues(result.response.request());
      const current = await candidates();
      assert.equal(current.status, 200);
      const created = current.data.results.find(
        (row) => row.first_name === data.name,
      );
      assert(created, `Created record ${data.key} missing after reload`);
      const row = {
        index,
        key: data.key,
        name: data.name,
        id: created.id,
        code: created.code_cv,
        createStatus: result.response.status(),
        createdValues: sent,
        file,
        currentStatus: created.cv_status_id,
        deleted: false,
      };
      report.records.push(row);
      save();
      check(`create-${String(index).padStart(2, "0")}`, "passed", {
        id: row.id,
        code: row.code,
        phoneLength: data.phone.length,
        optionalFieldsOmitted: data.minimal,
        fileBytes: file?.bytes || 0,
      });
    }
    assert.equal(report.records.length, 20);
    const final = await candidates();
    assert.equal(final.data.count, 20);
    assert.equal(final.data.results.length, 20);
    check("twenty-created-reloaded", "passed", { count: 20 });
  }
  const context = {
    page,
    report,
    save,
    check,
    prefix,
    today,
    base,
    fixture,
    pdf,
    submit,
    choose,
    close,
    candidates,
    requests,
    openCandidate,
    waitPath,
  };
  try {
    await page.goto(base + "/login");
    await page.locator("#login-username").fill(credentials.username);
    await page.locator("#login-password").fill(credentials.password);
    await page
      .getByRole("button", { name: "Sign In to Ticket", exact: true })
      .click();
    await page.waitForURL((url) => url.pathname !== "/login");
    if (phase === "create") await createRecords();
    else await require("./ticket-recruitment-20-scenarios.cjs")(phase, context);
    report.phases[phase] = { result: "passed", at: new Date().toISOString() };
    save();
  } catch (error) {
    report.phases[phase] = {
      result: "failed",
      message: error.message,
      at: new Date().toISOString(),
    };
    save();
    await page
      .screenshot({
        path: `/tmp/ticket-recruitment-20-${phase}-failure.png`,
        animations: "disabled",
      })
      .catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
