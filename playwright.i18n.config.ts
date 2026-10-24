import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "i18n.spec.ts",
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results/i18n/browser",
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/i18n/report", open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:5188",
    headless: true,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {},
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --mode test --host 127.0.0.1 --port 5188 --strictPort",
    url: "http://127.0.0.1:5188",
    reuseExistingServer: false,
  },
});
