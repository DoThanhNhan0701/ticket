import { notificationJourney } from "./modules/notifications";
import { guideSettings, guideRequest, guideReports } from "./modules/guide";
import {
  prepareActionActors,
  ticketActionJourney,
} from "./modules/ticket-actions";
import {
  hrJourney,
  hrCancelJourney,
  interviewRegression,
  retainedHrCleanup,
} from "./modules/hr";
import { extendedJourney } from "./modules/extended";
import { cloneRegression } from "./modules/regression";
import { test, expect, Harness } from "./harness";
import { menu, routes } from "./discovery";
import { initialAuth } from "./modules/auth";
import { listPage, shell } from "./modules/navigation";
import { settingsCrud, cleanupSettings } from "./modules/settings";
import {
  requestJourney,
  cleanupRequest,
  longNameGuard,
} from "./modules/requests";
import { reports, recruitment, help } from "./modules/secondary";
import {
  continuousStability,
  switchAccount,
  directRoutes,
  finalLogout,
} from "./modules/session";

test("continuous frontend workflow: one browser, one context, UI-only navigation and state validation", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: "Asia/Ho_Chi_Minh",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const h = new Harness(page, context, info);
  await h.install();
  try {
    await initialAuth(h);
    if (process.env.E2E_NOTIFICATIONS_ONLY === "true") {
      await notificationJourney(h);
      await finalLogout(h);
      return;
    }
    if (process.env.E2E_HR_UI_ONLY === "true") {
      for (const item of menu.filter((item) => item.module === "recruitment"))
        await listPage(h, item);
      await recruitment(h);
      await finalLogout(h);
      return;
    }
    if (process.env.E2E_HR_CLEANUP_FIXTURES) {
      await retainedHrCleanup(h);
      await finalLogout(h);
      return;
    }
    if (process.env.E2E_INTERVIEW_ONLY === "true") {
      await interviewRegression(h);
      await finalLogout(h);
      return;
    }
    if (process.env.E2E_CANCEL_ONLY === "true") {
      h.primaryName = process.env.E2E_PRIMARY_APPROVER_NAME;
      await hrCancelJourney(h);
      await finalLogout(h);
      return;
    }
    if (process.env.E2E_EXTENDED_ONLY === "true") {
      await extendedJourney(h);
      await finalLogout(h);
      return;
    }
    if (process.env.E2E_LONG_NAME_ONLY === "true") {
      await shell(h);
      await longNameGuard(h);
      await finalLogout(h);
      return;
    }
    if (process.env.E2E_REGRESSION_REQUEST) {
      await cloneRegression(h, process.env.E2E_REGRESSION_REQUEST);
      await finalLogout(h);
      return;
    }
    if (process.env.E2E_GUIDE_ONLY === "true") {
      await settingsCrud(h);
      await prepareActionActors(h);
      await guideSettings(h);
      await requestJourney(h);
      await guideRequest(h);
      await guideReports(h);
      await help(h);
      await cleanupRequest(h);
      await cleanupSettings(h);
      await finalLogout(h);
      return;
    }
    await shell(h);
    for (const item of menu) await listPage(h, item);
    await settingsCrud(h);
    await prepareActionActors(h);
    await guideSettings(h);
    await requestJourney(h);
    await guideRequest(h);
    await ticketActionJourney(h);
    await hrJourney(h);
    await reports(h);
    await recruitment(h);
    await guideReports(h);
    await help(h);
    await continuousStability(h);
    await switchAccount(h);
    await cleanupRequest(h);
    await cleanupSettings(h);
    await directRoutes(h);
    await finalLogout(h);
  } catch (error) {
    h.note(
      "workflow",
      "*",
      "Workflow interruption",
      h.redact(error instanceof Error ? error.message : String(error)),
      "FAIL",
    );
    for (const route of routes)
      if (!h.visits.has(route.route))
        h.note(
          route.module,
          route.route,
          "Remaining route after workflow interruption",
          "An earlier prerequisite failed; no browser reset or token replacement was used",
          "BLOCKED",
        );
  } finally {
    await h.stopTrace();
    const report = await h.finish();
    await context.close();
    expect
      .soft(
        report.matrix.filter((row) => row.status === "FAIL"),
        "Frontend failures are retained in the coverage matrix and HTML artifacts",
      )
      .toHaveLength(0);
    expect
      .soft(
        report.summary.unexpectedDocumentNavigations,
        "No unexpected full-document navigation during SPA scenarios",
      )
      .toHaveLength(0);
  }
});
