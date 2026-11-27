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
          name: "rainscales_ticket_access",
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
            "/api/list_handling_alltickettype/": [fixtures["request-types"]],
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
      for (const step of [1, 2, 4])
        await page.locator(`[data-request-step="${step}"]`).waitFor();
      assert.equal(await page.locator('[data-request-step="3"]').count(), 0);

      await page.evaluate(() => {
        window.scrollCalls = [];
        const main = document.querySelector("main");
        const native = main.scrollTo.bind(main);
        main.scrollTo = (options) => {
          window.scrollCalls.push(options);
          native(options);
        };
      });

      await page
        .getByRole("combobox", { name: "Loại yêu cầu", exact: true })
        .click();
      await page
        .getByRole("option", {
          name: fixtures["request-types"].name,
          exact: true,
        })
        .click();
      await page.locator("#detail-0-f0").fill("Completed detail");
      await page.locator("#create-description").fill("Optional notes");

      const layout = await page.evaluate(() => ({
        automaticScrolls: window.scrollCalls.length,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.equal(layout.automaticScrolls, 0);
      assert.equal(layout.horizontalOverflow, false);
      await page.screenshot({
        path: path.join(artifacts, `${scenario.name}.png`),
      });
      assert.deepEqual(errors, []);
      reports.push({ scenario: scenario.name, ...layout, errors });
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
