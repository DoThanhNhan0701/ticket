// Summarize observed frontend traffic; never issues requests or mutates fixtures.
const fs = require("node:fs");
const path = require("node:path");
const root = process.argv[2];
const file = path.join(root, "coverage-matrix.json");
if (!fs.existsSync(file)) process.exit(0);
const report = JSON.parse(fs.readFileSync(file, "utf8"));
const execution = JSON.parse(
  fs.readFileSync(path.join(root, "execution.json"), "utf8"),
);
const duplicates = report.requests.filter((request, index, all) =>
  all
    .slice(0, index)
    .some(
      (previous) =>
        request.method === "GET" &&
        previous.method === request.method &&
        previous.url === request.url &&
        previous.caseId === request.caseId &&
        request.start - previous.start < 500,
    ),
);
const details = {
  ...report.summary,
  fixturePrefix: execution.prefix,
  observedRequestFailures: report.requests.filter(
    (request) => request.failure || request.status >= 400,
  ),
  duplicateReadCandidatesWithin500ms: duplicates,
  unhandledRuntimeErrors: report.errors.filter(
    (error) => error.kind === "pageerror",
  ),
  consoleErrors: report.errors.filter((error) => error.kind === "console"),
  routeAccounting: report.routes.map((route) => ({
    ...route,
    scenarios: report.matrix
      .filter((row) => row.route === route.route)
      .map(({ id, status }) => ({ id, status })),
  })),
  reviewedFindings: report.bugs.map((bug) =>
    bug.steps.includes("Document language")
      ? {
          ...bug,
          priority: "P2",
          classification: "Confirmed frontend accessibility issue",
          steps: [
            "Log in through UI",
            "Open the Vietnamese workspace",
            "Inspect document.documentElement.lang",
          ],
          expected: "Document language matches the active interface language",
          actual: "Vietnamese workspace retains lang=en from index.html",
          recommendation:
            "Set document language from the active interface locale; verify login and workspace separately with a screen reader.",
        }
      : bug,
  ),
  extraLimitations: [
    "Repeated GETs are diagnostic candidates, not confirmed frontend bugs: cancellation, retries, and separate observers may explain them.",
    "API requests and browser console/pageerror events are recorded; a complete non-API failed-resource inventory was not collected.",
    "Long-task observations are diagnostic only; memory growth, visual flicker and layout remount counts were not instrumented.",
    "Check the scenario matrix for owned ticket/recruitment mutation results. File drag-and-drop, upload outage recovery, every actor/status combination and PDF configuration are not comprehensively executed. Unmatched source controls remain NOT RUN.",
    "Real token expiration was not awaited; token/storage substitution is intentionally absent.",
  ],
};
fs.writeFileSync(
  path.join(root, "frontend-report.json"),
  JSON.stringify(details, null, 2),
);
console.log(
  `Scenario results: ${JSON.stringify(details.counts)}; unexpected document navigations: ${details.unexpectedDocumentNavigations.length}`,
);
