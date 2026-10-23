import { Harness, expect, Blocked } from "../harness";

export async function initialAuth(h: Harness) {
  const p = h.page;
  await h.run(
    "auth",
    "/login",
    "Login form and required fields",
    async () => {
      await p.goto("/login");
      await expect(p.locator("html")).toHaveAttribute("lang", "vi");
      await expect(
        p.getByRole("button", { name: "Sign In to Ticket", exact: true }),
      ).toBeVisible();
      await p
        .getByRole("button", { name: "Sign In to Ticket", exact: true })
        .click();
      await expect(
        p.locator('#login-username[aria-invalid="true"]'),
      ).toBeVisible();
      await expect(
        p.locator('#login-password[aria-invalid="true"]'),
      ).toBeVisible();
    },
    { allowDocument: true, auth: true, component: "LoginPage" },
  );
  await h.run(
    "auth",
    "/login",
    "Show/hide password and keyboard form controls",
    async () => {
      await p.locator("#login-password").fill("QA_visibility_only");
      await p
        .getByRole("button", { name: "Show password", exact: true })
        .click();
      await expect(p.locator("#login-password")).toHaveAttribute(
        "type",
        "text",
      );
      await p
        .getByRole("button", { name: "Hide password", exact: true })
        .click();
      await expect(p.locator("#login-password")).toHaveAttribute(
        "type",
        "password",
      );
      await p.locator("#login-password").fill("");
      await p.locator("#login-username").focus();
      await p.keyboard.press("Tab");
      await expect(p.locator("#login-password")).toBeFocused();
    },
    { auth: true },
  );
  await h.run(
    "auth",
    "/login",
    "Incorrect password shows frontend error without logging in",
    async () => {
      await p.locator("#login-username").fill(process.env.E2E_USERNAME!);
      await p.locator("#login-password").fill(`QA_WRONG_${h.prefix}`);
      await p
        .getByRole("button", { name: "Sign In to Ticket", exact: true })
        .click();
      await expect(
        p.locator('[data-sonner-toast][data-type="error"]').first(),
      ).toBeVisible();
      await expect(p).toHaveURL(/\/login$/);
    },
    { auth: true },
  );
  await h.run(
    "auth",
    "/login",
    "Successful UI login, loading and duplicate submission prevention",
    async () => {
      await p.locator("#login-username").fill(process.env.E2E_USERNAME!);
      await p.locator("#login-password").fill(process.env.E2E_PASSWORD!);
      const count = h.requests.filter(
        (request) => request.method === "POST" && request.url === "/api/token/",
      ).length;
      const button = p.getByRole("button", {
        name: "Sign In to Ticket",
        exact: true,
      });
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      await p.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2, {
        clickCount: 2,
        delay: 35,
      });
      await expect(
        p.getByRole("button", { name: "Sign Out", exact: true }),
      ).toBeVisible();
      expect(
        h.requests.filter(
          (request) =>
            request.method === "POST" && request.url === "/api/token/",
        ).length - count,
      ).toBe(1);
      h.authenticated = true;
      h.visits.add("/login");
    },
    { auth: true },
  );
  for (const feature of [
    "Remember me",
    "Forgot password",
    "Change password",
    "Username format beyond required-field validation",
  ])
    h.note(
      "auth",
      "/login",
      feature,
      "No corresponding UI or additional username-format constraint is implemented in LoginPage/loginSchema.",
    );
  h.note(
    "auth",
    "/login",
    "Actual expired-session UI",
    "Not forced: auth tokens/storage are never overwritten and no backend response is replaced. A naturally expired session was not available in this run.",
  );
  if (!h.authenticated)
    throw new Blocked(
      "Primary login did not complete; protected scenarios cannot be executed",
    );
  await h.startTrace();
}
export async function logout(h: Harness) {
  await h.stopTrace();
  await h.page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(h.page.locator("#login-username")).toBeVisible();
  h.authenticated = false;
}
export async function uiLogin(h: Harness, username: string, password: string) {
  await h.page.locator("#login-username").fill(username);
  await h.page.locator("#login-password").fill(password);
  await h.page
    .getByRole("button", { name: "Sign In to Ticket", exact: true })
    .click();
  await expect(
    h.page.getByRole("button", { name: "Sign Out", exact: true }),
  ).toBeVisible();
  h.authenticated = true;
}
