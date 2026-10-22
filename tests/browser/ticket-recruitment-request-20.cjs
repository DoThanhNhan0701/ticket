const ticketTestEnv = require("../env.cjs");
// Live recruitment-request QC: browser UI only. Credentials {admin,approver} on stdin.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = ticketTestEnv.baseUrl;
const phase = process.env.QC_PHASE || "inspect";
const path = "tests/artifacts/ticket-recruitment-request-20.json";
const prefix = "TEST_HRREQ20_261021";
const report = fs.existsSync(path)
  ? JSON.parse(fs.readFileSync(path, "utf8"))
  : {
      prefix,
      method:
        "Real browser UI only: create HR tickets, approve through the UI, then inspect and update generated recruitment requests. No direct HTTP writes or mocks.",
      records: [],
      checks: [],
      writes: [],
      phases: {},
      pageErrors: [],
    };
const save = () =>
  fs.writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
function check(id, result, data = {}) {
  const { id: recordId, ...details } = data;
  const item = {
    id,
    phase,
    result,
    ...details,
    ...(recordId ? { recordId } : {}),
  };
  const at = report.checks.findIndex((x) => x.id === id);
  if (at < 0) report.checks.push(item);
  else report.checks[at] = item;
  save();
  console.log(JSON.stringify(item));
}
const waitPath = (page, path, method = "GET") =>
  page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === path && r.request().method() === method,
  );
async function choose(page, label, value) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  const search = page.getByRole("combobox", {
    name: "Tìm " + label.toLowerCase(),
    exact: true,
  });
  if (await search.count()) await search.fill(value);
  await page.getByRole("option", { name: value, exact: true }).click();
}
const clean = (s) => s.replaceAll("(*)", "").trim();
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const contexts = [];
  async function login(account) {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1050 },
      timezoneId: "Asia/Ho_Chi_Minh",
    });
    contexts.push(context);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on("response", async (response) => {
      const request = response.request();
      const pathname = new URL(response.url()).pathname;
      if (pathname.startsWith("/api/") && response.status() >= 400) {
        report.apiErrors ||= [];
        const item = {
          phase,
          path: pathname,
          method: request.method(),
          status: response.status(),
        };
        if (response.headers()["content-type"]?.includes("text/html")) {
          const html = await response.text().catch(() => "");
          item.exception = html
            .match(/<pre class="exception_value">([\s\S]*?)<\/pre>/)?.[1]
            ?.replace(/<[^>]*>/g, "")
            .slice(0, 300);
        }
        report.apiErrors.push(item);
        save();
      }
    });
    page.on("pageerror", (e) => {
      report.pageErrors.push({ phase, message: e.message });
      save();
    });
    await context.route("**/api/**", (route) => {
      const req = route.request(),
        p = new URL(req.url()).pathname,
        method = req.method();
      if (
        ["GET", "HEAD", "OPTIONS"].includes(method) ||
        ["/api/token/", "/api/token/refresh/"].includes(p)
      )
        return route.continue();
      let allowed = false;
      const ids = new Set(report.records.map((x) => x.ticketId));
      if (p === "/api/ticket_manager" && method === "POST")
        allowed =
          String(req.postDataJSON().title).startsWith(prefix) &&
          req.postDataJSON().handling_group === 3 &&
          req.postDataJSON().ticket_type === 99;
      else if (
        [
          "/api/accept_ticket/",
          "/api/receive_ticket/",
          "/api/done_ticket/",
          "/api/close_ticket/",
          "/api/cancel_ticket/",
        ].includes(p)
      )
        allowed = ids.has(req.postDataJSON().ticket_id);
      else if (/^\/api\/detail_recruitment\/\d+$/.test(p))
        allowed =
          method === "PUT" &&
          report.records.some((x) =>
            (x.recruitments || []).some(
              (row) => row.id === Number(p.split("/").pop()),
            ),
          );
      else if (/^\/api\/detail_cv\/\d+$/.test(p)) {
        const values = JSON.parse(
          req.postData()?.match(/name="values"\r\n\r\n([\s\S]*?)\r\n--/)?.[1] ||
            "{}",
        );
        allowed =
          method === "POST" &&
          String(values.first_name).startsWith(prefix) &&
          report.records.some((x) =>
            x.recruitments?.some(
              (row) => row.id === Number(p.split("/").pop()),
            ),
          );
      } else if (
        ["/api/export-recruitment/", "/api/check_form_cv/"].includes(p)
      )
        allowed = true;
      assert(allowed, `Unexpected business write ${method} ${p}`);
      report.writes.push({ phase, path: p, method });
      save();
      return route.continue();
    });
    await page.goto(base + "/login");
    await page.locator("#login-username").fill(account.username);
    await page.locator("#login-password").fill(account.password);
    await page
      .getByRole("button", { name: "Sign In to Ticket", exact: true })
      .click();
    await page.waitForURL((u) => u.pathname !== "/login");
    return page;
  }
  async function createForm(page) {
    await page.goto(base + "/requests/new");
    await choose(page, "Bộ phận xử lý", "HR");
    const template = waitPath(page, "/api/template_form/99");
    await choose(page, "Loại yêu cầu", "Yêu cầu tuyển dụng");
    const data = await (await template).json();
    await choose(page, "Người phê duyệt", "Nhan Nhan");
    await page.locator("#create-title").fill(prefix + " DRAFT");
    await choose(page, "Department", "TEST_20261020_G3CCBK Dept OK");
    await choose(page, "Văn phòng", "TEST_20261020_G3CCBK Office OK");
    await page.locator("#create-due-date").fill("30/11/2026");
    await page.locator("#detail-0-f0").waitFor();
    return data;
  }
  try {
    const page = await login(credentials.admin);
    if (phase === "inspect") {
      const template = await createForm(page);
      report.template = template;
      save();
      check("template-inspected", "passed", {
        fields: template.forms
          ?.flatMap((g) => g.children || [])
          .map((f) => ({
            title: f.title,
            type: f.type,
            required: f.required,
            options: f.option,
            validate: f.validate,
          })),
      });
      await choose(page, "Người phê duyệt", "Nhan Nhan");
      await choose(page, "Department", "TEST_20261020_G3CCBK Dept OK");
      await choose(page, "Văn phòng", "TEST_20261020_G3CCBK Office OK");
      check("creation-lookups-available", "passed");
      await page.screenshot({
        path: "/tmp/ticket-hrreq20-inspect.png",
        animations: "disabled",
        fullPage: true,
      });
    } else
      await require("./ticket-recruitment-request-20-scenarios.cjs")({
        phase,
        page,
        browser,
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
      });
    const phaseChecks = report.checks.filter((item) => item.phase === phase);
    let result = "passed";
    if (phaseChecks.some((item) => item.result === "failed"))
      result = "completed-with-issues";
    else if (phaseChecks.some((item) => item.result === "skipped"))
      result = "completed-with-skips";
    report.phases[phase] = { result, at: new Date().toISOString() };
    save();
  } catch (error) {
    report.phases[phase] = {
      result: "failed",
      message: error.message,
      at: new Date().toISOString(),
    };
    save();
    for (const c of contexts) {
      for (const p of c.pages())
        await p
          .screenshot({
            path: `/tmp/ticket-hrreq20-${phase}-failure-${contexts.indexOf(c)}.png`,
            animations: "disabled",
          })
          .catch(() => {});
    }
    throw error;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
