const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, expect } = require("@playwright/test");
const root = path.resolve("test-results/toast-header-20261024");
fs.mkdirSync(root, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [];
  try {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport });
      await context.addCookies([
        {
          name: "_access_token_ticket",
          value: "fixture",
          url: "http://127.0.0.1:5187",
        },
      ]);
      const page = await context.newPage();
      await page.route(
        (url) => url.pathname.startsWith("/api/"),
        async (route) => {
          if (
            new URL(route.request().url()).pathname === "/api/list_permission/"
          ) {
            return route.fulfill({
              json: {
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
            });
          }
          return route.fulfill({ json: [] });
        },
      );
      await page.goto("http://127.0.0.1:5187/requests/new");
      await expect(
        page.getByRole("button", { name: "Sign Out", exact: true }),
      ).toBeVisible();
      await page.evaluate(async () => {
        const entry = performance
          .getEntriesByType("resource")
          .find((resource) => /\/sonner\.js\?/.test(resource.name));
        if (!entry)
          throw new Error("Sonner module not found in resource timings");
        const { toast } = await import(entry.name);
        toast.dismiss();
        toast.success("Header overlap regression", { duration: Infinity });
      });
      const notification = page
        .locator("[data-sonner-toast]")
        .filter({ hasText: "Header overlap regression" });
      await expect(notification).toBeVisible();
      await expect
        .poll(async () => {
          const header = await page.locator("header").first().boundingBox();
          const box = await notification.boundingBox();
          return box.y - header.y - header.height;
        })
        .toBeGreaterThanOrEqual(0);
      const header = await page.locator("header").first().boundingBox();
      const box = await notification.boundingBox();
      await page.screenshot({ path: path.join(root, `${viewport.width}.png`) });
      await page.getByRole("button", { name: "Sign Out", exact: true }).click();
      await expect(page.locator("#login-username")).toBeVisible();
      assert.ok(box.y >= header.y + header.height);
      results.push({
        viewport,
        gapBelowHeader: box.y - header.y - header.height,
        logoutWhileToastVisible: "PASS",
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    path.join(root, "report.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
