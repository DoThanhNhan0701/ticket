// Pass {username,password,testPassword?} on stdin, or use E2E_USERNAME/E2E_PASSWORD.
const fs = require("node:fs");
const path = require("node:path");
const { tmpdir } = require("node:os");
const { spawnSync, execFileSync } = require("node:child_process");
let credentials = {};
if (!process.stdin.isTTY) {
  const input = fs.readFileSync(0, "utf8").trim();
  if (input) credentials = JSON.parse(input);
}
const artifacts =
  process.env.E2E_ARTIFACT_DIR ||
  path.join(
    tmpdir(),
    "ticket-frontend-e2e",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
fs.mkdirSync(artifacts, { recursive: true, mode: 0o700 });
const env = {
  ...process.env,
  E2E_ARTIFACT_DIR: artifacts,
  E2E_USERNAME: credentials.username || process.env.E2E_USERNAME || "",
  E2E_PASSWORD: credentials.password || process.env.E2E_PASSWORD || "",
  E2E_TEST_PASSWORD:
    credentials.testPassword || process.env.E2E_TEST_PASSWORD || "",
};
if (!env.E2E_USERNAME || !env.E2E_PASSWORD)
  throw new Error(
    "Supply UI login credentials on stdin or in E2E_USERNAME/E2E_PASSWORD.",
  );
console.log(`Frontend E2E artifacts: ${artifacts}`);
const result = spawnSync(
  process.execPath,
  [
    require.resolve("@playwright/test/cli"),
    "test",
    "--config=playwright.config.ts",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env },
);
if (result.error) throw result.error;
execFileSync(
  process.execPath,
  [path.join(__dirname, "summarize-e2e.cjs"), artifacts],
  { stdio: "inherit" },
);
execFileSync(
  process.env.PYTHON_EXECUTABLE || "python3",
  [path.join(__dirname, "sanitize-e2e-artifacts.py"), artifacts],
  {
    input: JSON.stringify([env.E2E_PASSWORD, env.E2E_TEST_PASSWORD]),
    stdio: ["pipe", "inherit", "inherit"],
  },
);
console.log(`HTML report: ${path.join(artifacts, "html", "index.html")}`);
process.exitCode = result.status ?? 1;
