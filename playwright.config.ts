import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";

const artifacts =
  process.env.E2E_ARTIFACT_DIR ||
  join(tmpdir(), "ticket-frontend-e2e", "latest");
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30 * 60 * 1000,
  expect: { timeout: 10000 },
  outputDir: join(artifacts, "results"),
  reporter: [
    ["line"],
    ["html", { outputFolder: join(artifacts, "html"), open: "never" }],
    ["json", { outputFile: join(artifacts, "playwright.json") }],
  ],
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:5186",
    headless: process.env.HEADLESS === "true",
    viewport: { width: 1440, height: 900 },
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "off", // Auth traces may contain credentials. Sanitized chunks are attached after login only.
    screenshot: "off", // Failure-only screenshots are captured by the scenario harness, outside source.
    launchOptions: {
      executablePath:
        process.env.BROWSER_EXECUTABLE || "/opt/microsoft/msedge/msedge",
      slowMo: Number(process.env.SLOW_MO || 80),
      args: ["--no-sandbox"],
    },
  },
  projects: [{ name: "chromium" }],
});
