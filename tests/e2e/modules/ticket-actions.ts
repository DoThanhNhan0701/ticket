import { addDays, format } from "date-fns";
import fs from "node:fs";
import path from "node:path";
import { Harness, expect, Blocked } from "../harness";
import { openTicket } from "./requests";
import { requireOwn, readyEditor, saveEditor } from "./settings";
import { logout, uiLogin } from "./auth";

export async function prepareActionActors(h: Harness) {
  await h.run(
    "ticket-actions",
    "/settings/request-types",
    "Configure own processing section so detail edits are exercised",
    async () => {
      const type = requireOwn(h, "request-types");
      await h.nav("Loại yêu cầu");
      await h.search(type.name);
      await h.page
        .getByRole("button", { name: `Biểu mẫu ${type.name}`, exact: true })
        .click();
      const d = h.page.getByRole("dialog");
      await d.getByRole("button", { name: "Thêm phần", exact: true }).click();
      await d
        .getByRole("button", { name: "Mở rộng phần 2", exact: true })
        .click();
      await d.locator("#template-group-1").fill(`${h.prefix} Xử lý`);
      await d
        .locator('label[for="template-group-edit-1"]')
        .getByRole("checkbox")
        .click();
      await d
        .getByRole("button", { name: "Thêm trường", exact: true })
        .last()
        .click();
      await d.locator("#template-1-0-title").fill("Kết quả xử lý");
      await d
        .locator('label[for="template-1-0-handling"]')
        .getByRole("checkbox")
        .click();
      await d
        .getByRole("button", { name: "Lưu biểu mẫu", exact: true })
        .click();
      await expect(d).toHaveCount(0);
    },
  );
  await h.run(
    "requests",
    "/settings/users",
    "Identify primary approver from its own user profile via UI",
    async () => {
      await h.nav("Người dùng");
      await h.search(process.env.E2E_USERNAME!);
      await h.page
        .getByRole("button", {
          name: `Chỉnh sửa ${process.env.E2E_USERNAME}`,
          exact: true,
        })
        .click();
      const d = await readyEditor(h);
      h.primaryName = [
        await d.locator("#settings-last_name").inputValue(),
        await d.locator("#settings-first_name").inputValue(),
      ]
        .filter(Boolean)
        .join(" ");
      await d.getByRole("button", { name: "Hủy", exact: true }).click();
      expect(h.primaryName).toBeTruthy();
    },
  );
  await h.run(
    "requests",
    "/settings/handling-departments",
    "Add primary actor to own handling-group members for assignment/forward actions",
    async () => {
      const group = requireOwn(h, "handling-departments");
      await h.nav("Bộ phận xử lý");
      await h.search(group.name);
      await h.page
        .getByRole("button", { name: `Chỉnh sửa ${group.name}`, exact: true })
        .click();
      const d = await readyEditor(h);
      await d.getByRole("button", { name: "Thành viên", exact: true }).click();
      const search = h.page.getByRole("searchbox", {
        name: "Search thành viên",
        exact: true,
      });
      await search.fill(process.env.E2E_USERNAME!);
      const option = h.page
        .getByRole("button", { pressed: false })
        .filter({ hasText: new RegExp(`^${process.env.E2E_USERNAME} ·`) });
      if (await option.count()) await option.first().click();
      await h.page.keyboard.press("Escape");
      await saveEditor(h, group.name);
    },
  );
}
export async function switchActor(h: Harness, secondary: boolean) {
  const user = secondary
    ? requireOwn(h, "users").username!
    : process.env.E2E_USERNAME!;
  const password = secondary
    ? process.env.E2E_TEST_PASSWORD
    : process.env.E2E_PASSWORD;
  if (!password)
    throw new Blocked(
      "Secondary UI login requires E2E_TEST_PASSWORD from secure input",
    );
  await h.run(
    "auth",
    "/login",
    `Switch action actor through Logout/Login UI: ${secondary ? "disposable handler" : "primary manager"}`,
    async () => {
      await logout(h);
      await uiLogin(h, user, password);
      h.secondaryActor = secondary;
    },
    { auth: true },
  );
  await h.startTrace();
}
export async function openAction(h: Harness, name: string) {
  const group = h.page.getByRole("group", {
    name: "Thao tác yêu cầu",
    exact: true,
  });
  const button = group.getByRole("button", { name, exact: true });
  if (!(await button.isVisible().catch(() => false)))
    throw new Blocked(
      `Action '${name}' is unavailable in the actual account/state; available: ${(
        await group
          .getByRole("button")
          .allTextContents()
          .catch(() => [])
      ).join(", ")}`,
    );
  await button.click();
  return h.page.getByRole("dialog", { name: `${name} yêu cầu`, exact: true });
}
export async function confirmAction(
  h: Harness,
  name: string,
  d = h.page.getByRole("dialog").last(),
) {
  await d.getByRole("button", { name, exact: true }).click();
  await expect(
    h.page.getByText(`Đã thực hiện: ${name}.`, { exact: true }).first(),
  ).toBeVisible();
  await expect(d).toHaveCount(0);
  return {
    availableActions: await h.page
      .getByRole("group", { name: "Thao tác yêu cầu", exact: true })
      .getByRole("button")
      .allTextContents(),
  };
}
async function selectUser(h: Harness, label: string, username: string) {
  await h.page
    .getByRole("dialog")
    .last()
    .getByRole("combobox", { name: label, exact: true })
    .click();
  const option = h.page
    .getByRole("option")
    .filter({ hasText: username })
    .first();
  if (!(await option.count())) {
    await h.page.keyboard.press("Escape");
    throw new Blocked(`Owned actor '${username}' is absent from '${label}'`);
  }
  await option.click();
}
async function multiUser(h: Harness, label: string, username: string) {
  await h.page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name: label, exact: true })
    .click();
  const option = h.page
    .getByRole("button", { pressed: false })
    .filter({ hasText: username })
    .first();
  if (!(await option.count())) {
    await h.page.keyboard.press("Escape");
    throw new Blocked(
      `Owned actor '${username}' is not available for '${label}'`,
    );
  }
  await option.click();
  await h.page.keyboard.press("Escape");
}
export async function ticketActionJourney(h: Harness) {
  const route = "/requests/:ticketID",
    own = () => requireOwn(h, "users").username!;
  await h.run(
    "ticket-actions",
    route,
    "Approve own request; inspect/cancel confirmation before real save",
    async () => {
      await openTicket(h);
      let d = await openAction(h, "Phê duyệt");
      await d.getByRole("button", { name: "Thoát", exact: true }).click();
      await expect(d).toHaveCount(0);
      d = await openAction(h, "Phê duyệt");
      return confirmAction(h, "Phê duyệt", d);
    },
  );
  await h.run(
    "ticket-actions",
    route,
    "Receive own approved request",
    async () => {
      await openTicket(h);
      return confirmAction(h, "Tiếp nhận", await openAction(h, "Tiếp nhận"));
    },
  );
  await h.run(
    "ticket-actions",
    route,
    "Due date: reject non-extension, cancel draft and save/reopen a valid extension",
    async () => {
      await openTicket(h);
      await h.page
        .getByRole("button", { name: "Đổi ngày mong muốn", exact: true })
        .click();
      const input = h.page.locator("#ticket-due-date");
      const before = await input.inputValue();
      await input.fill("");
      await h.page
        .getByRole("button", { name: "Lưu ngày mong muốn", exact: true })
        .click();
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await input.fill(before);
      await h.page
        .getByRole("button", { name: "Lưu ngày mong muốn", exact: true })
        .click();
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await h.page
        .getByRole("button", { name: "Hủy đổi ngày", exact: true })
        .click();
      await h.page
        .getByRole("button", { name: "Đổi ngày mong muốn", exact: true })
        .click();
      await expect(input).toHaveValue(before);
      const after = format(addDays(new Date(), 40), "dd/MM/yyyy");
      await input.fill(after);
      await h.page
        .getByRole("button", { name: "Lưu ngày mong muốn", exact: true })
        .click();
      await expect(
        h.page
          .getByText("Đã cập nhật ngày mong muốn.", { exact: true })
          .first(),
      ).toBeVisible();
      await openTicket(h);
      await h.page
        .getByRole("button", { name: "Đổi ngày mong muốn", exact: true })
        .click();
      await expect(input).toHaveValue(after);
      await h.page
        .getByRole("button", { name: "Hủy đổi ngày", exact: true })
        .click();
    },
  );
  await h.run(
    "ticket-actions",
    route,
    "Edit processing detail section: cancel unsaved changes then save and reopen",
    async () => {
      await openTicket(h);
      await h.page
        .getByRole("tab", { name: "Chi tiết yêu cầu", exact: true })
        .click();
      const edit = h.page
        .getByRole("button", { name: "Chỉnh sửa", exact: true })
        .first();
      if (!(await edit.count()))
        throw new Blocked(
          "No editable processing section is available on this owned fixture",
        );
      await edit.click();
      const input = h.page.getByRole("textbox", {
        name: "Kết quả xử lý",
        exact: true,
      });
      await input.fill(`${h.prefix} UNSAVED`);
      await h.page
        .getByRole("tabpanel")
        .getByRole("button", { name: "Hủy", exact: true })
        .click();
      await expect(
        h.page.getByText(`${h.prefix} UNSAVED`, { exact: true }),
      ).toHaveCount(0);
      await edit.click();
      await input.fill(`${h.prefix} Saved processing result`);
      await h.page
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await expect(
        h.page.getByText("Đã lưu chi tiết yêu cầu.", { exact: true }).first(),
      ).toBeVisible();
      await openTicket(h);
      await h.page
        .getByRole("tab", { name: "Chi tiết yêu cầu", exact: true })
        .click();
      await expect(
        h.page.getByText(`${h.prefix} Saved processing result`, {
          exact: true,
        }),
      ).toBeVisible();
    },
  );
  if (process.env.E2E_DETAIL_ONLY === "true") return;
  await h.run(
    "ticket-actions",
    route,
    "Upload multiple detail attachments in processing state",
    async () => {
      await openTicket(h);
      await h.page
        .getByRole("tab", { name: "Thông tin chung", exact: true })
        .click();
      const names = [`${h.prefix}_detail_1.txt`, `${h.prefix}_đính-kèm_2.txt`];
      await h.page
        .locator('input[type="file"]')
        .first()
        .setInputFiles(
          names.map((name) => ({
            name,
            mimeType: "text/plain",
            buffer: Buffer.from(name),
          })),
        );
      await h.page
        .getByRole("button", { name: "Tải lên đính kèm", exact: true })
        .click();
      for (const name of names)
        await expect(
          h.page.getByRole("link", { name, exact: true }),
        ).toBeVisible();
    },
  );
  await h.run(
    "ticket-actions",
    route,
    "Assignment add: required selection, then persist own disposable handler",
    async () => {
      await openTicket(h);
      const d = await openAction(h, "Phân công");
      await h.choose("Loại phân công", "Thêm người xử lý", d);
      await d.getByRole("button", { name: "Phân công", exact: true }).click();
      await expect(
        d.getByText(
          /Người nhận xử lý is required\.|Vui lòng chọn người xử lý hợp lệ\./,
        ),
      ).toBeVisible();
      await multiUser(h, "Người nhận xử lý", own());
      return confirmAction(h, "Phân công", d);
    },
  );
  await h.run(
    "ticket-actions",
    route,
    "Assignment delete: reason validation and remove only own disposable handler",
    async () => {
      await openTicket(h);
      const d = await openAction(h, "Phân công");
      await h.choose("Loại phân công", "Xóa người xử lý", d);
      await multiUser(h, "Người cần xóa khỏi yêu cầu", own());
      await d.getByRole("button", { name: "Phân công", exact: true }).click();
      await expect(d.locator('[aria-invalid="true"]').first()).toBeVisible();
      await d.getByRole("textbox").fill(`${h.prefix} Remove test handler`);
      return confirmAction(h, "Phân công", d);
    },
  );
  await h.run(
    "ticket-actions",
    route,
    "Assignment change: replace primary actor with own handler and required reason",
    async () => {
      await openTicket(h);
      const d = await openAction(h, "Phân công");
      await h.choose("Loại phân công", "Thay đổi người xử lý", d);
      await selectUser(h, "Người đang xử lý", process.env.E2E_USERNAME!);
      await selectUser(h, "Người nhận xử lý mới", own());
      await d.getByRole("textbox").fill(`${h.prefix} Replace test handler`);
      return confirmAction(h, "Phân công", d);
    },
  );
  await h.run(
    "ticket-actions",
    route,
    "Add primary handler back and remove disposable handler before forwarding",
    async () => {
      await openTicket(h);
      let d = await openAction(h, "Phân công");
      await h.choose("Loại phân công", "Thêm người xử lý", d);
      await multiUser(h, "Người nhận xử lý", process.env.E2E_USERNAME!);
      await confirmAction(h, "Phân công", d);
      d = await openAction(h, "Phân công");
      await h.choose("Loại phân công", "Xóa người xử lý", d);
      await multiUser(h, "Người cần xóa khỏi yêu cầu", own());
      await d.getByRole("textbox").fill(`${h.prefix} Forward setup`);
      return confirmAction(h, "Phân công", d);
    },
  );
  await h.run(
    "ticket-actions",
    route,
    "Complete-dialog forward: validate recipient and forward to own disposable handler",
    async () => {
      await openTicket(h);
      await openAction(h, "Hoàn thành");
      const d = h.page.getByRole("dialog").last();
      await d.getByRole("button", { name: "Chuyển tiếp", exact: true }).click();
      await d
        .getByRole("button", { name: "Chuyển tiếp", exact: true })
        .last()
        .click();
      await expect(d.locator('[aria-invalid="true"]').first()).toBeVisible();
      await selectUser(h, "Người nhận chuyển tiếp", own());
      return confirmAction(h, "Chuyển tiếp", d);
    },
  );
  await switchActor(h, true);
  await h.run(
    "ticket-actions",
    route,
    "Disposable handler completes forwarded own request",
    async () => {
      await openTicket(h);
      const receive = h.page
        .getByRole("group", { name: "Thao tác yêu cầu", exact: true })
        .getByRole("button", { name: "Tiếp nhận", exact: true });
      if (await receive.isVisible().catch(() => false))
        await confirmAction(h, "Tiếp nhận", await openAction(h, "Tiếp nhận"));
      return confirmAction(h, "Hoàn thành", await openAction(h, "Hoàn thành"));
    },
  );
  await switchActor(h, false);
  await h.run(
    "ticket-actions",
    route,
    "Primary actor finishes its remaining processing work before final lifecycle actions",
    async () => {
      await openTicket(h);
      return confirmAction(h, "Hoàn thành", await openAction(h, "Hoàn thành"));
    },
  );
  await h.run(
    "ticket-actions",
    route,
    "Reprocess completed request: empty reason validation and persisted confirmation",
    async () => {
      await openTicket(h);
      const d = await openAction(h, "Xử lý lại");
      await d.getByRole("button", { name: "Xử lý lại", exact: true }).click();
      await expect(d.locator('[aria-invalid="true"]').first()).toBeVisible();
      await d.getByRole("textbox").fill(`${h.prefix} Reprocess cycle 1`);
      return confirmAction(h, "Xử lý lại", d);
    },
  );
  await h.run(
    "ticket-actions",
    route,
    "Manager declines reprocess with required reason",
    async () => {
      await openTicket(h);
      const d = await openAction(h, "Hoàn thành");
      await d.getByRole("button", { name: "Hoàn thành", exact: true }).click();
      await expect(d.getByRole("textbox")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await d.getByRole("textbox").fill(`${h.prefix} Verify decline reason`);
      return confirmAction(h, "Hoàn thành", d);
    },
  );
  await h.run(
    "ticket-actions",
    route,
    "Reprocess second cycle, receive and complete through UI",
    async () => {
      await openTicket(h);
      const d = await openAction(h, "Xử lý lại");
      await d.getByRole("textbox").fill(`${h.prefix} Reprocess cycle 2`);
      await confirmAction(h, "Xử lý lại", d);
      await confirmAction(h, "Tiếp nhận", await openAction(h, "Tiếp nhận"));
      return confirmAction(h, "Hoàn thành", await openAction(h, "Hoàn thành"));
    },
  );
  const closed = await h.run(
    "ticket-actions",
    route,
    "Creator closes own completed request; status/edit actions disappear",
    async () => {
      await openTicket(h);
      await confirmAction(h, "Đóng", await openAction(h, "Đóng"));
      await expect(
        h.page.getByRole("group", { name: "Thao tác yêu cầu", exact: true }),
      ).toHaveCount(0);
      await expect(
        h.page.getByRole("button", { name: "Đổi ngày mong muốn", exact: true }),
      ).toHaveCount(0);
    },
  );
  h.closedTicket = closed === "PASS";
  fs.writeFileSync(
    path.join(h.root, "action-fixtures.json"),
    JSON.stringify(
      {
        prefix: h.prefix,
        primaryName: h.primaryName,
        own: h.own,
        ticket: h.ticket,
      },
      null,
      2,
    ),
  );
}
