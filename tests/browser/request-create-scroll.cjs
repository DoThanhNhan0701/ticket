const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const { settingsFixtures: fixtures } = require("../fixtures/settings.ts");
const artifacts = path.resolve("test-results/request-create-scroll");
fs.mkdirSync(artifacts, { recursive: true });
const paginated = (results) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});
const template = {
  forms: [
    {
      title: "UI scroll check",
      editable: true,
      children: [
        { key: 1, title: "Required detail", type: "text", required: true },
        { key: 2, title: "Optional detail", type: "text", required: false },
      ],
    },
  ],
};
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const reports = [];
  try {
    for (const scenario of [
      {
        name: "desktop",
        viewport: { width: 1440, height: 900 },
        reducedMotion: "no-preference",
      },
      {
        name: "mobile",
        viewport: { width: 390, height: 844 },
        reducedMotion: "no-preference",
      },
      {
        name: "mobile-reduced",
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      },
    ]) {
      const context = await browser.newContext({
        viewport: scenario.viewport,
        reducedMotion: scenario.reducedMotion,
      });
      await context.addCookies([
        {
          name: "_access_token_ticket",
          value: "ui-fixture-token",
          url: "http://localhost:5173",
        },
      ]);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route(
        (url) => url.pathname.startsWith("/api/"),
        async (route) => {
          const url = new URL(route.request().url());
          assert.equal(
            route.request().method(),
            "GET",
            "UI check must not mutate backend data",
          );
          const responses = {
            "/api/list_permission/": {
              infoUser: [42, "ui-check", null],
              userPermission: ["can_create"],
              handlingPermission: {},
              is_handling: false,
              is_superuser: false,
              ls_permission: [],
              ls_department: [],
              ls_cv_status: [],
              ls_ticket_status: [],
            },
            "/api/list_customer/": [
              { id: 2, name: "Rainscales VN", is_active: true },
            ],
            "/api/list_useraccept/": [fixtures.users],
            "/api/list_handling_group/": paginated([
              fixtures["handling-departments"],
            ]),
            "/api/list_bophan_sudung/": paginated([
              fixtures["requesting-departments"],
            ]),
            "/api/list_team/": [fixtures.teams],
            "/api/list_vanphong/": [fixtures.offices],
            "/api/list_tickettype/": paginated([fixtures["request-types"]]),
          };
          if (url.pathname.startsWith("/api/template_form/")) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
            return route.fulfill({ json: template });
          }
          if (!(url.pathname in responses))
            throw new Error(`Unexpected API: ${url.pathname}`);
          return route.fulfill({ json: responses[url.pathname] });
        },
      );
      await page.goto("http://localhost:5173/requests/new");
      await page.locator('[data-request-step="1"]').waitFor();
      await page.evaluate(() => {
        window.scrollCalls = [];
        const main = document.querySelector("main");
        const native = main.scrollTo.bind(main);
        main.scrollTo = (options) => {
          window.scrollCalls.push(options);
          native(options);
        };
      });
      const choose = async (label, option) => {
        await page.getByRole("combobox", { name: label, exact: true }).click();
        await page.getByRole("option", { name: option, exact: true }).click();
      };
      const stages = [];
      const checkBottom = async (step, action) => {
        await page.evaluate(() => {
          window.scrollSamples = [];
          window.samplingScroll = true;
          const sample = () => {
            const main = document.querySelector("main");
            window.scrollSamples.push({
              top: main.scrollTop,
              max: main.scrollHeight - main.clientHeight,
            });
            if (window.samplingScroll) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
        const beforeCalls = await page.evaluate(
          () => window.scrollCalls.length,
        );
        await action();
        await page.locator(`[data-request-step="${step}"]`).waitFor();
        await page.waitForFunction(
          (before) => {
            const main = document.querySelector("main");
            return (
              window.scrollCalls.length > before &&
              Math.abs(
                main.scrollHeight - main.clientHeight - main.scrollTop,
              ) <= 1
            );
          },
          beforeCalls,
          { timeout: 10000 },
        );
        await page.waitForTimeout(250);
        const result = await page.evaluate(() => {
          window.samplingScroll = false;
          const main = document.querySelector("main");
          return {
            remaining: main.scrollHeight - main.clientHeight - main.scrollTop,
            max: main.scrollHeight - main.clientHeight,
            calls: window.scrollCalls,
            samples: window.scrollSamples,
            horizontalOverflow:
              document.documentElement.scrollWidth > innerWidth,
          };
        });
        assert.ok(
          Math.abs(result.remaining) <= 1,
          `Step ${step} must reach the actual bottom`,
        );
        assert.equal(result.horizontalOverflow, false);
        const positions = new Set(result.samples.map((sample) => sample.top));
        stages.push({
          step,
          remaining: result.remaining,
          max: result.max,
          distinctPositions: positions.size,
          behavior: result.calls.at(-1).behavior,
        });
        await page.screenshot({
          path: path.join(artifacts, `${scenario.name}-step-${step}.png`),
        });
      };
      await choose("Bộ phận xử lý", fixtures["handling-departments"].name);
      await choose("Loại yêu cầu", fixtures["request-types"].name);
      await checkBottom(2, () => choose("Người phê duyệt", "Đỗ Nhân"));
      await choose("Department", fixtures["requesting-departments"].name);
      await choose("Văn phòng", fixtures.offices.name);
      await checkBottom(3, () =>
        page.locator("#create-title").fill("UI scroll verification"),
      );
      await checkBottom(4, () =>
        page.locator("#detail-0-f0").fill("Completed detail"),
      );
      const callsBeforeEditing = await page.evaluate(
        () => window.scrollCalls.length,
      );
      await page
        .locator("#create-description")
        .fill("Continue editing without another automatic scroll");
      await page.waitForTimeout(500);
      assert.equal(
        await page.evaluate(() => window.scrollCalls.length),
        callsBeforeEditing,
      );
      assert.deepEqual(errors, []);
      reports.push({ scenario: scenario.name, stages, errors });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    path.join(artifacts, "report.json"),
    JSON.stringify(reports, null, 2),
  );
  console.log(JSON.stringify(reports, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
