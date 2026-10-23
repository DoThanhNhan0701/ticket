import {
  expect,
  test,
  type Page,
  type BrowserContext,
  type TestInfo,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { discoverControls, menu, routes } from "./discovery";

export type Status = "PASS" | "FAIL" | "BLOCKED" | "NOT RUN";
export interface Case {
  id: string;
  module: string;
  route: string;
  component: string;
  feature: string;
  scenario: string;
  expected: string;
  actual: string;
  status: Status;
  evidence?: string[];
  error?: string;
  durationMs?: number;
}
export class Blocked extends Error {}
export class Harness {
  readonly root = process.env.E2E_ARTIFACT_DIR!;
  readonly prefix = `TESTFE_${Date.now().toString(36).slice(-6).toUpperCase()}`;
  readonly cases: Case[] = [];
  readonly controls = discoverControls();
  readonly visits = new Set<string>();
  readonly directVisits = new Set<string>();
  readonly interactions: {
    label: string;
    id: string;
    path: string;
    caseId: string;
    role: string;
  }[] = [];
  readonly errors: {
    kind: string;
    message: string;
    route: string;
    caseId: string;
  }[] = [];
  readonly documents: { url: string; caseId: string; expected: boolean }[] = [];
  readonly requests: {
    method: string;
    url: string;
    start: number;
    status?: number;
    failure?: string;
    caseId: string;
  }[] = [];
  readonly own: Record<
    string,
    { name: string; username?: string; active?: boolean }
  > = {};
  readonly secrets = new Set(
    [
      process.env.E2E_PASSWORD || "",
      process.env.E2E_TEST_PASSWORD || "",
    ].filter(Boolean),
  );
  current = "bootstrap";
  expectedDocument = true;
  tracing = false;
  authenticated = false;
  secondaryHr = false;
  secondaryActor = false;
  closedTicket = false;
  primaryName?: string;
  ticket?: { title: string; href: string; code: string };
  private sequence = 0;
  constructor(
    readonly page: Page,
    readonly context: BrowserContext,
    readonly info: TestInfo,
  ) {}
  redact(value: string) {
    let safe = value.replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[REDACTED_JWT]",
    );
    this.secrets.forEach((secret) => {
      safe = safe.split(secret).join("[REDACTED]");
    });
    return safe;
  }
  async install() {
    fs.mkdirSync(this.root, { recursive: true });
    await this.page.exposeBinding(
      "__qaObserve",
      (_, event: { label: string; id: string; path: string; role: string }) => {
        this.interactions.push({ ...event, caseId: this.current });
      },
    );
    await this.page.addInitScript(() => {
      const scope = window as unknown as {
        __qaDocument: string;
        __qaLongTasks: number[];
        __qaObserve: (event: object) => void;
      };
      scope.__qaDocument = crypto.randomUUID();
      scope.__qaLongTasks = [];
      try {
        new PerformanceObserver((list) =>
          scope.__qaLongTasks.push(
            ...list.getEntries().map((entry) => entry.duration),
          ),
        ).observe({ type: "longtask", buffered: true });
      } catch {
        /* Unsupported observers are recorded as a limitation. */
      }
      document.addEventListener(
        "click",
        (event) => {
          if (!event.isTrusted || !(event.target instanceof Element)) return;
          const element = event.target.closest(
            "button,a,input,select,textarea,summary,[role=button],[role=checkbox],[role=option]",
          ) as HTMLElement | null;
          if (element)
            void scope.__qaObserve({
              label:
                element.getAttribute("aria-label") ||
                element.getAttribute("title") ||
                element.innerText?.trim().slice(0, 140) ||
                "",
              id:
                element.id ||
                element.closest("label")?.getAttribute("for") ||
                "",
              role:
                element.getAttribute("role") || element.tagName.toLowerCase(),
              path: location.pathname,
            });
        },
        true,
      );
    });
    this.page.on("pageerror", (error) =>
      this.errors.push({
        kind: "pageerror",
        message: this.redact(error.message),
        route: this.page.url(),
        caseId: this.current,
      }),
    );
    this.page.on("console", (message) => {
      if (message.type() === "error")
        this.errors.push({
          kind: "console",
          message: this.redact(message.text()),
          route: this.page.url(),
          caseId: this.current,
        });
    });
    this.page.on("request", (request) => {
      const url = new URL(request.url());
      const auth = request.headers().authorization;
      if (auth) this.secrets.add(auth.replace(/^Bearer /, ""));
      if (
        request.isNavigationRequest() &&
        request.frame() === this.page.mainFrame()
      )
        this.documents.push({
          url: url.origin + url.pathname,
          caseId: this.current,
          expected: this.expectedDocument,
        });
      if (url.pathname.startsWith("/api/"))
        this.requests.push({
          method: request.method(),
          url: url.pathname + url.search,
          start: Date.now(),
          caseId: this.current,
        });
    });
    this.page.on("response", (response) => {
      const row = [...this.requests]
        .reverse()
        .find(
          (request) =>
            request.url ===
              new URL(response.url()).pathname +
                new URL(response.url()).search && request.status === undefined,
        );
      if (row) row.status = response.status();
    });
    this.page.on("requestfailed", (request) => {
      const row = [...this.requests]
        .reverse()
        .find(
          (item) =>
            item.url ===
              new URL(request.url()).pathname + new URL(request.url()).search &&
            !item.status,
        );
      if (row) row.failure = request.failure()?.errorText;
    });
  }
  async documentId() {
    return this.page
      .evaluate(
        () => (window as unknown as { __qaDocument?: string }).__qaDocument,
      )
      .catch(() => undefined);
  }
  note(
    module: string,
    route: string,
    feature: string,
    reason: string,
    status: Status = "NOT RUN",
  ) {
    this.cases.push({
      id: `C${++this.sequence}`,
      module,
      route,
      component: module,
      feature,
      scenario: feature,
      expected: "Execute through available frontend UI",
      actual: reason,
      status,
    });
  }
  async run(
    module: string,
    route: string,
    feature: string,
    action: () => Promise<unknown>,
    options: {
      allowDocument?: boolean;
      auth?: boolean;
      component?: string;
    } = {},
  ) {
    const row: Case = {
      id: `C${++this.sequence}`,
      module,
      route,
      component: options.component || module,
      feature,
      scenario: feature,
      expected:
        "Visible UI state updates correctly, session persists, no unexpected document navigation",
      actual: "",
      status: "NOT RUN",
    };
    this.cases.push(row);
    this.current = row.id;
    this.expectedDocument = !!options.allowDocument;
    const before = await this.documentId();
    const errorStart = this.errors.length;
    const start = Date.now();
    if (this.tracing && !options.auth)
      await this.context.tracing.startChunk({ title: `${row.id}: ${feature}` });
    await test
      .step(`${row.id} ${module}: ${feature}`, async () => {
        try {
          const details = await action();
          const after = await this.documentId();
          if (!options.allowDocument && before && after)
            expect(
              after,
              "Internal navigation must preserve document identity",
            ).toBe(before);
          expect(
            this.errors
              .slice(errorStart)
              .filter((error) => error.kind === "pageerror"),
            "No unhandled JavaScript error",
          ).toEqual([]);
          row.actual = details
            ? JSON.stringify(details)
            : "Assertions passed through visible UI";
          row.status = "PASS";
        } catch (error) {
          row.status = error instanceof Blocked ? "BLOCKED" : "FAIL";
          row.error = this.redact(
            error instanceof Error ? error.message : String(error),
          );
          row.actual = row.error;
          if (row.status === "FAIL") {
            const screenshot = path.join(this.root, `${row.id}-failure.png`);
            await this.page
              .screenshot({ path: screenshot, fullPage: false })
              .catch(() => {});
            row.evidence = [screenshot];
            await this.info
              .attach(`${row.id} failure screenshot`, {
                path: screenshot,
                contentType: "image/png",
              })
              .catch(() => {});
          }
        } finally {
          row.durationMs = Date.now() - start;
          if (this.tracing && !options.auth) {
            if (row.status === "FAIL") {
              const trace = path.join(this.root, `${row.id}-trace.zip`);
              await this.context.tracing.stopChunk({ path: trace });
              this.sanitizeTrace(trace);
              row.evidence = [...(row.evidence || []), trace];
              await this.info.attach(`${row.id} sanitized trace`, {
                path: trace,
                contentType: "application/zip",
              });
            } else await this.context.tracing.stopChunk();
          }
          this.save();
        }
        if (row.status === "FAIL") throw new Error(row.error);
      })
      .catch(() => undefined);
    this.expectedDocument = false;
    if (row.status !== "PASS") await this.recover();
    return row.status;
  }
  async recover() {
    for (let attempt = 0; attempt < 3; attempt++) {
      const dialog = this.page.getByRole("dialog").last();
      if (!(await dialog.isVisible().catch(() => false))) return;
      await this.page.keyboard.press("Escape");
      if (await dialog.isVisible().catch(() => false)) {
        const cancel = dialog
          .getByRole("button", { name: /^(Hủy|Ở lại|Đóng)( chọn thao tác)?$/ })
          .first();
        if (await cancel.isVisible().catch(() => false)) await cancel.click();
      }
    }
  }
  async startTrace() {
    if (!this.tracing) {
      await this.context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: false,
      });
      this.tracing = true;
    }
  }
  async stopTrace() {
    if (this.tracing) {
      await this.context.tracing.stop();
      this.tracing = false;
    }
  }
  sanitizeTrace(file: string) {
    execFileSync(
      "python3",
      [
        "-c",
        "import sys,json,zipfile,re,os; p=sys.argv[1]; secrets=json.load(sys.stdin); z=zipfile.ZipFile(p); out=p+'.safe'; w=zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED)\nfor i in z.infolist():\n b=z.read(i.filename)\n if not i.filename.endswith(('.png','.jpeg','.jpg','.webm')):\n  try:\n   t=b.decode('utf-8'); t=re.sub(r'eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+','[REDACTED_JWT]',t)\n   for s in secrets:\n    if s:t=t.replace(s,'[REDACTED]')\n   b=t.encode()\n  except UnicodeDecodeError:pass\n w.writestr(i,b)\nw.close();z.close();os.replace(out,p)",
        file,
      ],
      {
        input: JSON.stringify([...this.secrets]),
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  }
  async nav(label: string) {
    const item = menu.find((entry) => entry.label === label);
    if (!item) throw new Error(`Unknown sidebar item: ${label}`);
    const mobile = this.page.getByRole("button", {
      name: "Mở menu điều hướng",
      exact: true,
    });
    let root;
    if (await mobile.isVisible()) {
      await mobile.click();
      root = this.page.getByRole("dialog");
    } else {
      const expand = this.page.getByRole("button", {
        name: "Mở rộng sidebar",
        exact: true,
      });
      if (await expand.isVisible()) await expand.click();
      root = this.page.locator("#desktop-sidebar");
    }
    const section = root.locator("details").filter({
      has: this.page.locator("summary").filter({ hasText: item.group }),
    });
    if (!(await section.count()))
      throw new Blocked(
        `Sidebar group '${item.group}' is unavailable for this account`,
      );
    if ((await section.getAttribute("open")) === null)
      await section.locator("summary").click();
    const link = section.getByRole("link", { name: label, exact: true });
    if (!(await link.count())) {
      await this.recover();
      throw new Blocked(
        `Permission-gated UI: '${label}' is not visible for the signed-in account`,
      );
    }
    await link.click();
    await expect(this.page).toHaveURL((url) => url.pathname === item.route);
    await expect(
      this.page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
    this.visits.add(item.route);
    await this.settle();
  }
  async settle() {
    await this.page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await expect(this.page.locator('section[aria-busy="true"]')).toHaveCount(
      0,
      { timeout: 20000 },
    );
  }
  async search(value: string) {
    const field = this.page.getByRole("searchbox").first();
    await field.fill(value);
    await field.press("Enter");
    await this.settle();
  }
  async choose(
    label: string,
    value: string,
    root = this.page as Page | ReturnType<Page["getByRole"]>,
  ) {
    await root.getByRole("combobox", { name: label, exact: true }).click();
    const search = this.page.getByRole("combobox", {
      name: `Tìm ${label.toLowerCase()}`,
      exact: true,
    });
    if (await search.isVisible().catch(() => false)) await search.fill(value);
    await this.page.getByRole("option", { name: value, exact: true }).click();
  }
  async responsive() {
    const result: object[] = [];
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ]) {
      await this.page.setViewportSize({ width, height });
      await expect
        .poll(() =>
          this.page.evaluate(() => ({
            document: document.documentElement.scrollWidth,
            viewport: innerWidth,
            main: document.querySelector("main")?.clientWidth || 0,
            scroll: document.querySelector("main")?.scrollWidth || 0,
          })),
        )
        .toMatchObject({ viewport: width });
      await expect
        .poll(() =>
          this.page.evaluate(
            () =>
              document.documentElement.scrollWidth <= innerWidth + 1 &&
              (document.querySelector("main")?.scrollWidth || 0) <=
                (document.querySelector("main")?.clientWidth || 0) + 1,
          ),
        )
        .toBe(true);
      result.push({ width, height });
    }
    await this.page.setViewportSize({ width: 1440, height: 900 });
    return result;
  }
  async axe() {
    const scan = await new AxeBuilder({ page: this.page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    fs.writeFileSync(
      path.join(this.root, `${this.current}-axe.json`),
      JSON.stringify(scan.violations, null, 2),
    );
    expect(
      scan.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.map((node) => node.target),
      })),
      "WCAG automated violations",
    ).toEqual([]);
    return { checks: scan.passes.length };
  }
  save() {
    fs.writeFileSync(
      path.join(this.root, "execution.json"),
      JSON.stringify(
        {
          prefix: this.prefix,
          ownedFixtures: this.own,
          ownedTicket: this.ticket,
          primaryName: this.primaryName,
          cases: this.cases,
          documents: this.documents,
          errors: this.errors,
          requests: this.requests,
          interactions: this.interactions,
        },
        null,
        2,
      ),
    );
  }
  async finish() {
    const covered = new Set(
      this.cases.filter((row) => row.status === "PASS").map((row) => row.id),
    );
    const staticControls = this.controls.map((control) => {
      const observed = this.interactions.filter(
        (event) =>
          covered.has(event.caseId) &&
          ((control.controlId && event.id === control.controlId) ||
            (control.label && event.label === control.label)),
      );
      return {
        ...control,
        status: observed.length ? "PASS" : "NOT RUN",
        reason: observed.length
          ? `Observed in asserted scenarios: ${[...new Set(observed.map((event) => event.caseId))].join(", ")}`
          : "Source-discovered conditional/shared control not matched to a successful interaction in this run; no PASS inferred. See route/scenario limitations and component inventory.",
      };
    });
    for (const route of routes)
      if (!this.cases.some((row) => row.route === route.route))
        this.note(
          route.module,
          route.route,
          `${route.label}: route accounting`,
          "No UI ingress reached for this contextual route in this session; see direct-route/permission checks",
          "NOT RUN",
        );
    const counts = Object.fromEntries(
      (["PASS", "FAIL", "BLOCKED", "NOT RUN"] as Status[]).map((status) => [
        status,
        this.cases.filter((row) => row.status === status).length,
      ]),
    );
    const unexpected = this.documents.filter((document) => !document.expected);
    const bugs = this.cases
      .filter((row) => row.status === "FAIL")
      .map((row) => ({
        priority:
          row.feature.includes("document") || row.feature.includes("SPA")
            ? "P1"
            : "P2",
        module: row.module,
        route: row.route,
        steps: row.feature,
        expected: row.expected,
        actual: row.actual,
        evidence: row.evidence,
        classification: this.requests.some(
          (request) =>
            request.caseId === row.id && (request.status || 0) >= 500,
        )
          ? "backend/network-dependent; frontend error presentation requires review"
          : "frontend or automation; review trace and reproduction before assigning root cause",
        recommendation:
          "Review recorded UI state and sanitized trace; no application source was modified automatically.",
      }));
    const summary = {
      canonicalRoutes: routes.length,
      legacyRoutes: routes.flatMap((route) => route.aliases).length,
      visitedViaUi: [...this.visits],
      visitedViaDirectIngress: [...this.directVisits],
      staticControlOccurrences: staticControls.length,
      assertedMatchedStaticControls: staticControls.filter(
        (control) => control.status === "PASS",
      ).length,
      counts,
      scenarioCoveragePercent:
        Math.round((10000 * counts.PASS) / this.cases.length) / 100,
      coverageDenominator:
        "All discovered/planned scenario rows including BLOCKED and NOT RUN; source-control inventory separately includes unmatched conditional/shared controls and does not imply full interaction coverage.",
      unexpectedDocumentNavigations: unexpected,
      singleBrowserContext: true,
      credentialArtifacts:
        "Authentication tracing disabled; trace JWTs/passwords sanitized before attachment.",
      limitations: [
        "Automated axe and keyboard checks are not a complete manual accessibility audit.",
        "Source occurrence inventory includes conditional/shared controls that may not be reachable for this account; unmatched controls remain NOT RUN.",
        "No backend code/schema/business-rule tests or direct API substitutions were used.",
        "Authentication traces are omitted to avoid credentials in artifacts.",
      ],
    };
    const report = {
      summary,
      routes,
      matrix: this.cases,
      staticControls,
      bugs,
      errors: this.errors,
      documents: this.documents,
      requests: this.requests,
    };
    fs.writeFileSync(
      path.join(this.root, "coverage-matrix.json"),
      JSON.stringify(report, null, 2),
    );
    const csv = [
      "Module,Route,Component,UI Feature,Test Scenario,Expected,Actual,Status,Evidence,Error Details",
      ...this.cases.map((row) =>
        [
          row.module,
          row.route,
          row.component,
          row.feature,
          row.scenario,
          row.expected,
          row.actual,
          row.status,
          row.evidence?.join("; ") || "",
          row.error || "",
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    fs.writeFileSync(path.join(this.root, "coverage-matrix.csv"), csv);
    fs.writeFileSync(
      path.join(this.root, "bugs.json"),
      JSON.stringify(bugs, null, 2),
    );
    this.save();
    await this.info.attach("Frontend coverage matrix and limitations", {
      path: path.join(this.root, "coverage-matrix.json"),
      contentType: "application/json",
    });
    await this.info.attach("Frontend prioritized bug candidates", {
      path: path.join(this.root, "bugs.json"),
      contentType: "application/json",
    });
    return report;
  }
}
export { expect, test };
