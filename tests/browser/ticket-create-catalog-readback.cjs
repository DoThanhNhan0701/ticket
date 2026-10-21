// Read-only UI audit of every ticket created by ticket-create-catalog.cjs.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { parseISO, startOfDay } = require("date-fns");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const {
  clean,
  plannedDates,
  fieldValue,
} = require("./ticket-create-catalog-data.cjs");
const base = process.env.BASE_URL || "http://127.0.0.1:5189";
const sourcePath =
  process.env.CATALOG_REPORT || "tests/artifacts/ticket-create-catalog.json";
const reportPath =
  process.env.READBACK_REPORT ||
  "tests/artifacts/ticket-create-catalog-readback.json";
const report = fs.existsSync(reportPath)
  ? JSON.parse(fs.readFileSync(reportPath, "utf8"))
  : {
      method:
        "Read-only UI search/open/detail-tab audit. Detail responses triggered by those clicks are observed; every displayed cell is compared with the five rows entered during creation. No direct HTTP calls or mutations.",
      results: [],
    };
const save = () =>
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
let browser;
(async () => {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    timezoneId: "Asia/Ho_Chi_Minh",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("request", (r) => {
    if (r.method() !== "GET")
      assert(
        ["/api/token/", "/api/token/refresh/"].includes(
          new URL(r.url()).pathname,
        ),
        "Unexpected write during readback",
      );
  });
  await page.goto(base + "/login");
  await page.locator("#login-username").fill(credentials.username);
  await page.locator("#login-password").fill(credentials.password);
  await page
    .getByRole("button", { name: "Sign In to Ticket", exact: true })
    .click();
  await page.waitForURL("**/requests");
  const visited = new Set(
    report.results
      .filter((row) => row.status === "passed")
      .map((row) => row.id),
  );
  while (true) {
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const result = source.results.find((row) => row.id && !visited.has(row.id));
    if (!result) {
      if (source.summary || source.fatal) break;
      await page.waitForTimeout(1000);
      continue;
    }
    const check = {
      id: result.id,
      typeId: result.typeId,
      type: result.type,
      status: "running",
    };
    const old = report.results.findIndex((row) => row.id === check.id);
    if (old < 0) report.results.push(check);
    else report.results[old] = check;
    save();
    try {
      if (!/\/requests(?:\?.*)?$/.test(page.url()))
        await page
          .getByRole("button", { name: "Quay lại", exact: true })
          .click();
      await page
        .getByRole("searchbox", { name: "Tìm kiếm yêu cầu", exact: true })
        .fill(result.title);
      await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
      const row = page.getByRole("row").filter({
        has: page.getByRole("link", { name: result.title, exact: true }),
      });
      await row.waitFor();
      const detailResponse = page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/api/ticket_manager/" + result.id,
      );
      await row.getByRole("link").first().click();
      const response = await detailResponse;
      assert(response.ok());
      const ticket = await response.json();
      assert.equal(ticket.id, result.id);
      assert.equal(ticket.title, result.title);
      assert.equal(ticket.ticket_status, 1);
      await page
        .getByRole("tab", { name: "Chi tiết yêu cầu", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document
            .getElementById("ticket-tab-1")
            ?.getAttribute("aria-selected") === "true",
      );
      const header = ticket.data_item?.dataform?.header || [];
      const data = ticket.data_item?.dataform?.data || [];
      const fields = header
        .filter((group) => group.editable !== false)
        .flatMap((group) => group.children);
      const offsets = plannedDates(fields);
      const day = startOfDay(parseISO(ticket.created));
      if (fields.length) assert.equal(data.length, 5);
      const tables = await page
        .locator("#ticket-panel-1 table")
        .evaluateAll((elements) =>
          elements.map((table) =>
            [...table.querySelectorAll("tbody tr")].map((row) =>
              [...row.querySelectorAll("td")]
                .slice(1)
                .map((cell) => cell.textContent.trim()),
            ),
          ),
        );
      assert.equal(tables.length, header.length);
      let cells = 0;
      for (let index = 0; index < data.length; index++) {
        const expected = Object.fromEntries(
          fields.map((field) => {
            const value = fieldValue(field, index, offsets, day);
            return [
              typeof field.dataIndex === "string"
                ? field.dataIndex
                : field.title,
              field.type === "range-date-text" && !field.option?.length
                ? value + " - " + value
                : value,
            ];
          }),
        );
        for (let group = 0; group < header.length; group++) {
          assert.equal(tables[group].length, data.length);
          for (
            let column = 0;
            column < header[group].children.length;
            column++
          ) {
            const field = header[group].children[column];
            const key =
              typeof field.dataIndex === "string"
                ? field.dataIndex
                : field.title;
            const value = expected[key] || "";
            assert.equal(
              String(data[index][key] ?? ""),
              value,
              "Stored value differs: " +
                clean(field.title) +
                " row " +
                (index + 1),
            );
            assert.equal(
              tables[group][index][column],
              value || "—",
              "UI cell differs: " + clean(field.title) + " row " + (index + 1),
            );
            cells++;
          }
        }
      }
      check.status = "passed";
      check.rows = data.length;
      check.creationFields = fields.length;
      check.sections = header.length;
      check.verifiedCells = cells;
    } catch (error) {
      check.status = "failed";
      check.reason = error.message;
    }
    visited.add(result.id);
    save();
    console.log(JSON.stringify(check));
  }
  report.summary = {
    tickets: report.results.length,
    passed: report.results.filter((row) => row.status === "passed").length,
    failed: report.results.filter((row) => row.status !== "passed").length,
    verifiedCells: report.results.reduce(
      (sum, row) => sum + (row.verifiedCells || 0),
      0,
    ),
  };
  save();
})()
  .catch((error) => {
    report.fatal = error.message;
    save();
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    save();
    if (browser) await browser.close();
  });
