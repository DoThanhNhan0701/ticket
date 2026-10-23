import { Harness, expect, Blocked } from "../harness";
import { routes, menu } from "../discovery";
import { listPage } from "./navigation";
import { recruitment } from "./secondary";
import { logout, uiLogin } from "./auth";
import { requireOwn } from "./settings";

export async function continuousStability(h: Harness) {
  await h.run(
    "navigation",
    "/requests",
    "Repeated cross-module SPA journey preserves authenticated header and document",
    async () => {
      for (let round = 0; round < 3; round++)
        for (const label of [
          "Danh sách yêu cầu",
          "Người dùng",
          "Văn phòng",
          "Chức vụ",
        ]) {
          await h.nav(label);
          await expect(
            h.page.getByRole("button", { name: "Sign Out", exact: true }),
          ).toBeVisible();
        }
      return {
        moduleTransitions: 12,
        longTasksMs: await h.page.evaluate(
          () =>
            (window as unknown as { __qaLongTasks: number[] }).__qaLongTasks,
        ),
      };
    },
  );
}
export async function switchAccount(h: Harness) {
  let secondary = false;
  await h.run(
    "auth",
    "/login",
    "Logout through UI, Back does not restore protected content",
    async () => {
      await logout(h);
      await h.page.goBack();
      await expect(h.page.locator("#login-username")).toBeVisible();
      await expect(
        h.page.getByRole("button", { name: "Sign Out", exact: true }),
      ).toHaveCount(0);
    },
    { auth: true },
  );
  await h.run(
    "auth",
    "/login",
    "Login newly created user in same context and verify stale admin UI is absent",
    async () => {
      const own = requireOwn(h, "users");
      if (!process.env.E2E_TEST_PASSWORD)
        throw new Blocked(
          "No permitted default password supplied; Create User UI does not expose a password field",
        );
      await uiLogin(h, own.username!, process.env.E2E_TEST_PASSWORD);
      secondary = true;
      await expect(
        h.page.getByText(own.username!, { exact: true }).first(),
      ).toBeVisible();
      await expect(
        h.page.getByRole("link", { name: "Người dùng", exact: true }),
      ).toHaveCount(0);
    },
    { auth: true },
  );
  if (secondary) {
    await h.startTrace();
    if (h.secondaryHr) {
      for (const item of menu.filter((item) => item.module === "recruitment"))
        await listPage(h, item);
      await recruitment(h);
    }
    await h.run(
      "auth",
      "/settings/users",
      "Limited-user direct protected route shows unauthorized UI",
      async () => {
        await h.page.goto("/settings/users");
        await expect(
          h.page.getByRole("heading", {
            name: "Bạn chưa có quyền truy cập",
            exact: true,
          }),
        ).toBeVisible();
        h.visits.add("/forbidden");
      },
      { allowDocument: true },
    );
    await h.stopTrace();
    await h.run(
      "auth",
      "/forbidden",
      "Unauthorized page returns to login through its actual button",
      async () => {
        await h.page
          .getByRole("button", { name: "Đăng nhập lại", exact: true })
          .click();
        await expect(h.page.locator("#login-username")).toBeVisible();
        h.authenticated = false;
      },
      { auth: true },
    );
  } else
    h.note(
      "auth",
      "/settings/users",
      "Limited-user permission UI",
      "New-user login did not complete; do not replace tokens to simulate another role",
      "BLOCKED",
    );
  await h.run(
    "auth",
    "/login",
    "Restore primary user by Login UI and recover administrative navigation",
    async () => {
      if (
        await h.page
          .getByRole("button", { name: "Sign Out", exact: true })
          .isVisible()
          .catch(() => false)
      )
        await logout(h);
      await uiLogin(h, process.env.E2E_USERNAME!, process.env.E2E_PASSWORD!);
      await h.nav("Người dùng");
      await expect(
        h.page.getByRole("button", { name: "Thêm mới", exact: true }),
      ).toBeVisible();
    },
    { auth: true },
  );
  if (h.authenticated) await h.startTrace();
}
export async function directRoutes(h: Harness) {
  for (const row of routes) {
    if (["/login", "/forbidden"].includes(row.route)) continue;
    const resolve = (route: string) => {
      if (route.includes(":ticketID")) {
        if (!h.ticket) return null;
        return route.replace(":ticketID", h.ticket.href.split("/").pop()!);
      }
      if (route.includes(":codeInterview")) return null;
      return route === "*" ? "/qa-no-such-route" : route;
    };
    for (const ingress of [row.route, ...row.aliases]) {
      const url = resolve(ingress);
      if (!url) {
        h.note(
          row.module,
          row.route,
          `Direct ingress ${ingress}`,
          "A concrete owned request/interview URL is unavailable; no guessed ID was used",
          "BLOCKED",
        );
        continue;
      }
      await h.run(
        row.module,
        row.route,
        `Explicit direct-route/legacy ingress ${ingress} (full document load expected)`,
        async () => {
          await h.page.goto(url, { waitUntil: "domcontentloaded" });
          if (row.route === "/" || row.route === "*")
            await expect(h.page).toHaveURL(/\/requests(?:\?|$)/);
          else if (row.route === "/settings")
            await expect(h.page).toHaveURL(/\/settings\/users(?:\?|$)/);
          else if (row.route.includes("from-email")) {
            await expect(
              h.page.getByText("Trang đang được chuẩn bị", { exact: true }),
            ).toBeVisible();
          } else {
            const expected = resolve(row.route)!;
            await expect(h.page).toHaveURL(
              (actual) =>
                actual.pathname === expected ||
                actual.pathname === "/forbidden",
            );
            if (new URL(h.page.url()).pathname === "/forbidden")
              throw new Blocked(
                "The account cannot access this direct route; unauthorized UI was reached",
              );
            await expect(h.page.getByRole("main")).not.toBeEmpty();
          }
          h.directVisits.add(row.route);
          if (await h.page.getByRole("dialog").count()) await h.recover();
        },
        { allowDocument: true, component: row.component },
      );
    }
  }
  h.note(
    "requests",
    "/tickets/from-email/:ticketID",
    "Email-request functionality",
    "The current source renders a preparation placeholder for this contextual route; no implemented email-request form to exercise",
    "BLOCKED",
  );
  h.note(
    "navigation",
    "*",
    "404 error page",
    "Unknown URLs intentionally redirect to the permission-aware landing page; a standalone 404 page is not implemented.",
  );
}
export async function finalLogout(h: Harness) {
  await h.run(
    "auth",
    "/login",
    "Final Logout and browser Forward cannot expose previous protected page",
    async () => {
      if (new URL(h.page.url()).pathname === "/forbidden")
        await h.page
          .getByRole("button", { name: "Đăng nhập lại", exact: true })
          .click();
      else await logout(h);
      await expect(h.page.locator("#login-username")).toBeVisible();
      await h.page.goForward();
      await expect(h.page.locator("#login-username")).toBeVisible();
    },
    { auth: true, allowDocument: true },
  );
}
