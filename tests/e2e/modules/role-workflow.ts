import fs from "node:fs";
import path from "node:path";
import { Harness, expect } from "../harness";
import { logout, uiLogin } from "./auth";
import {
  cleanupSettings,
  editOwn,
  readyEditor,
  requireOwn,
  saveEditor,
  settingsCrud,
} from "./settings";
import { requestJourney, cleanupRequest } from "./requests";
import { confirmAction, openAction } from "./ticket-actions";
import { hrJourney } from "./hr";
import { menu } from "../discovery";
import { listPage } from "./navigation";
import { recruitment } from "./secondary";

export async function cleanupHrRoleTickets(h: Harness, files: string[]) {
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const fixture = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!fixture.ticket) continue;
    await h.run(
      "roles",
      "/requests/change-status",
      `Administrator cleans owned HR ticket ${fixture.ticket.code}`,
      async () => {
        expect(fixture.ticket.title).toMatch(/^TESTFE_[A-Z0-9]{6} HR /);
        expect(fixture.ticket.code).toMatch(/^HR_\d{6}_\d+$/);
        await h.page.goto(fixture.ticket.href);
        await expect(
          h.page.getByText(fixture.ticket.title, { exact: true }),
        ).toBeVisible();
        const status = h.page.getByRole("group", {
          name: "Trạng thái yêu cầu",
          exact: true,
        });
        if ((await status.innerText()).trim() !== "Hủy") {
          await h.nav("Chuyển trạng thái yêu cầu");
          await h.page.locator("#change-status-code").fill(fixture.ticket.code);
          await h.choose("Trạng thái", "Hủy");
          await h.page
            .locator("#change-status-reason")
            .fill(`${fixture.prefix} HR role test cleanup`);
          await h.page
            .getByRole("button", { name: "Cập nhật", exact: true })
            .click();
          await expect(
            h.page.locator('[data-sonner-toast][data-type="success"]').first(),
          ).toBeVisible();
          await h.page.goto(fixture.ticket.href);
          await expect(status).toHaveText("Hủy");
        }
        fixture.adminCleanup = "cancelled";
        fs.writeFileSync(file, JSON.stringify(fixture, null, 2));
      },
      { allowDocument: true },
    );
  }
}

export async function hrRoleWorkflow(h: Harness) {
  let secondary = false;
  try {
    await settingsCrud(h);
    if (h.cases.some((c) => c.status === "FAIL"))
      throw new Error("HR fixture setup failed");
    const configured = await h.run(
      "roles",
      "/settings/users",
      "Assign supplemental HR role to isolated test user",
      async () => {
        let d = await editOwn(h, "positions");
        await d.getByRole("button", { name: "Quyền hạn", exact: true }).click();
        for (const name of ["Tạo yêu cầu", "Xem hồ sơ phỏng vấn"])
          await h.page
            .getByRole("button", { name, exact: true, pressed: false })
            .click();
        await h.page.keyboard.press("Escape");
        await saveEditor(h, requireOwn(h, "positions").name);
        d = await editOwn(h, "users");
        await h.choose("Nhóm quyền bổ sung", "HR - Quản lý tuyển dụng", d);
        await saveEditor(h, requireOwn(h, "users").username!);
      },
    );
    if (configured !== "PASS") throw new Error("HR role could not be assigned");
    await h.run(
      "roles",
      "/login",
      "Login as HR and verify actual server-issued permissions",
      async () => {
        await logout(h);
        const response = h.page.waitForResponse(
          (r) => new URL(r.url()).pathname === "/api/list_permission/",
        );
        await uiLogin(
          h,
          requireOwn(h, "users").username!,
          process.env.E2E_TEST_PASSWORD!,
        );
        secondary = true;
        const account = await (await response).json();
        const permissions = [
          ...account.userPermission,
          ...Object.values(account.handlingPermission).flat(),
        ];
        fs.writeFileSync(
          path.join(h.root, "hr-role.json"),
          JSON.stringify(
            {
              username: requireOwn(h, "users").username,
              permissions,
              is_handling: account.is_handling,
              is_superuser: account.is_superuser,
            },
            null,
            2,
          ),
        );
        expect(permissions).toContain("can_hr_rec");
        expect(account.is_superuser).toBe(false);
        h.primaryName = requireOwn(h, "users").name;
      },
      { auth: true },
    );
    await h.startTrace();
    for (const item of menu.filter((item) => item.module === "recruitment"))
      await listPage(h, item);
    await hrJourney(h);
    await recruitment(h);
  } finally {
    if (secondary) {
      await h.run(
        "roles",
        "/login",
        "Return to administrator after HR workflow",
        async () => {
          await logout(h);
          await uiLogin(
            h,
            process.env.E2E_USERNAME!,
            process.env.E2E_PASSWORD!,
          );
        },
        { auth: true },
      );
      await h.startTrace();
    }
    await cleanupHrRoleTickets(h, [
      path.join(h.root, "hr-fixtures.json"),
      path.join(h.root, "hr-cancel-fixtures.json"),
    ]);
    await cleanupSettings(h);
  }
}

// Four independent identities: creator, approver, manager and assigned handler.
// Every mutation is performed through UI and restricted to this run's fixtures.
export async function roleWorkflow(h: Harness) {
  const extra: Array<{
    kind: "users" | "positions";
    name: string;
    username?: string;
    active: boolean;
  }> = [];
  const sessions: object[] = [];
  const persist = () =>
    fs.writeFileSync(
      path.join(h.root, "role-fixtures.json"),
      JSON.stringify(
        { prefix: h.prefix, extra, sessions, own: h.own, ticket: h.ticket },
        null,
        2,
      ),
    );
  const admin = process.env.E2E_USERNAME!;
  let actor = admin;
  let creatorUsername: string | undefined;
  const switchTo = async (username: string, role: string) => {
    const result = await h.run(
      "roles",
      "/login",
      `Login as ${role} through UI`,
      async () => {
        await logout(h);
        const pending = h.page.waitForResponse(
          (r) => new URL(r.url()).pathname === "/api/list_permission/",
        );
        await uiLogin(
          h,
          username,
          username === admin
            ? process.env.E2E_PASSWORD!
            : process.env.E2E_TEST_PASSWORD!,
        );
        actor = username;
        const account = await (await pending).json();
        sessions.push({
          role,
          username,
          userId: account.infoUser[0],
          permissions: account.userPermission,
          handlingPermission: account.handlingPermission,
          is_handling: account.is_handling,
          is_admin: account.is_admin,
          is_superuser: account.is_superuser,
        });
        persist();
      },
      { auth: true },
    );
    if (result !== "PASS") throw new Error(`Cannot continue as ${role}`);
    await h.startTrace();
  };
  const open = async () => {
    if (!h.ticket) throw new Error("Role ticket was not created");
    await h.page.goto(h.ticket.href);
    await expect(
      h.page.getByRole("tab", { name: "Thông tin chung", exact: true }),
    ).toBeVisible();
  };
  const step = async (name: string, action: () => Promise<unknown>) => {
    const result = await h.run(
      "roles",
      "/requests/:ticketID",
      name,
      async () => {
        await open();
        return action();
      },
      { allowDocument: true },
    );
    if (result !== "PASS") throw new Error(`Role prerequisite failed: ${name}`);
  };
  const doAction = async (name: string) =>
    confirmAction(h, name, await openAction(h, name));
  const createUser = async (suffix: string, position: string) => {
    const username = `${h.prefix.toLowerCase()}_${suffix}`;
    await h.nav("Người dùng");
    await h.page.getByRole("button", { name: "Thêm mới", exact: true }).click();
    const d = await readyEditor(h);
    for (const [key, value] of Object.entries({
      username,
      msnv: `${h.prefix.slice(7)}${suffix}`,
      last_name: "TEST",
      first_name: `${h.prefix}_${suffix}`,
      email: `${username}@example.invalid`,
    }))
      await d.locator(`#settings-${key}`).fill(value);
    await h.choose(
      "Department",
      requireOwn(h, "requesting-departments").name,
      d,
    );
    await h.choose("Team", requireOwn(h, "teams").name, d);
    await h.choose("Chức vụ", position, d);
    await saveEditor(h, username);
    const entry = {
      kind: "users" as const,
      username,
      name: `TEST ${h.prefix}_${suffix}`,
      active: true,
    };
    extra.push(entry);
    persist();
    return entry;
  };
  try {
    await settingsCrud(h);
    if (h.cases.some((c) => c.status === "FAIL"))
      throw new Error("Role fixture setup failed");
    let creator!: Awaited<ReturnType<typeof createUser>>;
    let approver!: Awaited<ReturnType<typeof createUser>>;
    await h.run(
      "roles",
      "/settings/users",
      "Create isolated creator and approver with minimal functional permissions",
      async () => {
        approver = await createUser(
          "approver",
          requireOwn(h, "positions").name,
        );
        const position = `${h.prefix}_CREATE`;
        await h.nav("Chức vụ");
        await h.page
          .getByRole("button", { name: "Thêm mới", exact: true })
          .click();
        const d = await readyEditor(h);
        await d.locator("#settings-name").fill(position);
        await d.getByRole("button", { name: "Quyền hạn", exact: true }).click();
        for (const label of ["Xem yêu cầu", "Tạo yêu cầu"])
          await h.page
            .getByRole("button", { name: label, exact: true, pressed: false })
            .click();
        await h.page.keyboard.press("Escape");
        await saveEditor(h, position);
        extra.push({ kind: "positions", name: position, active: true });
        persist();
        creator = await createUser("creator", position);
        creatorUsername = creator.username;
        h.primaryName = approver.name;
      },
    );
    if (!creator || !approver) throw new Error("Role accounts missing");
    await switchTo(creator.username!, "creator (view + create)");
    await requestJourney(h);
    if (!h.ticket) throw new Error("Creator did not submit a ticket");
    persist();
    await step(
      "Creator cannot approve its own ticket assigned to another approver",
      async () => {
        await expect(
          h.page.getByRole("button", { name: "Phê duyệt", exact: true }),
        ).toHaveCount(0);
      },
    );
    await switchTo(approver.username!, "designated approver (view + accept)");
    await step("Approver approves the creator's ticket", () =>
      doAction("Phê duyệt"),
    );
    await switchTo(admin, "handling-group manager");
    await step("Manager receives approved ticket", () => doAction("Tiếp nhận"));
    await step("Manager assigns independent handler", async () => {
      const d = await openAction(h, "Phân công");
      await h.choose("Loại phân công", "Thêm người xử lý", d);
      await d
        .getByRole("button", { name: "Người nhận xử lý", exact: true })
        .click();
      await h.page
        .getByRole("button", { pressed: false })
        .filter({ hasText: requireOwn(h, "users").username! })
        .click();
      await h.page.keyboard.press("Escape");
      return confirmAction(h, "Phân công", d);
    });
    await switchTo(requireOwn(h, "users").username!, "assigned handler");
    await step(
      "Handler cannot close the creator's ticket and completes its assigned work",
      async () => {
        await expect(
          h.page.getByRole("button", { name: "Đóng", exact: true }),
        ).toHaveCount(0);
        return doAction("Hoàn thành");
      },
    );
    await switchTo(admin, "handling-group manager");
    await step("Manager completes remaining work", () =>
      doAction("Hoàn thành"),
    );
    await switchTo(creator.username!, "creator");
    await step(
      "Creator requests reprocessing with required reason",
      async () => {
        const d = await openAction(h, "Xử lý lại");
        await d.getByRole("textbox").fill(`${h.prefix} Role reprocess`);
        return confirmAction(h, "Xử lý lại", d);
      },
    );
    await switchTo(admin, "handling-group manager");
    await step("Manager receives reprocessing request", () =>
      doAction("Tiếp nhận"),
    );
    await step("Manager completes reprocessing", () => doAction("Hoàn thành"));
    await switchTo(creator.username!, "creator");
    await step("Creator closes the completed ticket", async () => {
      await doAction("Đóng");
      await expect(
        h.page.getByRole("group", { name: "Thao tác yêu cầu", exact: true }),
      ).toHaveCount(0);
      h.closedTicket = true;
    });
  } finally {
    if (h.ticket && creatorUsername) {
      if (actor !== creatorUsername)
        await switchTo(creatorUsername, "creator for ticket cleanup");
      await cleanupRequest(h);
    }
    if (actor !== admin)
      await switchTo(admin, "administrator for fixture cleanup");
    // Lock extra users first, then their position; never touch existing accounts.
    for (const entry of [...extra].sort(
      (a, b) => Number(a.kind === "positions") - Number(b.kind === "positions"),
    )) {
      await h.run(
        "roles",
        `/settings/${entry.kind}`,
        `Lock disposable role ${entry.username || entry.name}`,
        async () => {
          const original = h.own[entry.kind];
          h.own[entry.kind] = entry;
          try {
            const d = await editOwn(h, entry.kind);
            const checkbox = d.getByRole("checkbox").first();
            if ((await checkbox.getAttribute("aria-checked")) === "true")
              await checkbox.click();
            await saveEditor(h, entry.username || entry.name);
            entry.active = false;
          } finally {
            h.own[entry.kind] = original;
            persist();
          }
        },
      );
    }
    await cleanupSettings(h);
    persist();
  }
}
