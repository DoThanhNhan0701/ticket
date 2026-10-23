import { Harness, expect, Blocked } from "../harness";

const entities = [
  { kind: "requesting-departments", label: "Bộ phận sử dụng", suffix: "BP" },
  { kind: "offices", label: "Văn phòng", suffix: "VP" },
  { kind: "positions", label: "Chức vụ", suffix: "CV" },
  { kind: "teams", label: "Team", suffix: "TEAM" },
  { kind: "users", label: "Người dùng", suffix: "USER" },
  { kind: "handling-departments", label: "Bộ phận xử lý", suffix: "XL" },
  { kind: "request-types", label: "Loại yêu cầu", suffix: "TYPE" },
];
export function requireOwn(h: Harness, kind: string) {
  const row = h.own[kind];
  if (!row)
    throw new Blocked(`Disposable ${kind} fixture was not created through UI`);
  expect((row.username || row.name).toUpperCase()).toContain(h.prefix);
  return row;
}
export async function readyEditor(h: Harness) {
  const d = h.page.getByRole("dialog");
  await expect(d.getByRole("button", { name: "Lưu", exact: true })).toBeEnabled(
    { timeout: 20000 },
  );
  return d;
}
export async function editOwn(h: Harness, kind: string) {
  const entity = entities.find((value) => value.kind === kind)!;
  const row = requireOwn(h, kind);
  await h.nav(entity.label);
  await h.search(row.username || row.name);
  await h.page
    .getByRole("button", {
      name: `Chỉnh sửa ${row.username || row.name}`,
      exact: true,
    })
    .click();
  return readyEditor(h);
}
async function multi(h: Harness, label: string, option: string) {
  await h.page
    .getByRole("dialog")
    .getByRole("button", { name: label, exact: true })
    .click();
  const search = h.page.getByRole("searchbox", {
    name: `Search ${label.toLowerCase()}`,
    exact: true,
  });
  if (await search.isVisible().catch(() => false)) await search.fill(option);
  await h.page
    .getByRole("button", { name: option, exact: true, pressed: false })
    .click();
  await h.page.keyboard.press("Escape");
}
export async function saveEditor(h: Harness, display: string) {
  const d = h.page.getByRole("dialog");
  await d.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(
    h.page.getByText(/Đã (thêm|cập nhật) dữ liệu\./).first(),
  ).toBeVisible();
  await h.search(display);
  await expect(
    h.page.getByRole("button", { name: `Chỉnh sửa ${display}`, exact: true }),
  ).toBeVisible();
}
export async function settingsCrud(h: Harness) {
  for (const entity of entities) {
    const route = `/settings/${entity.kind}`;
    await h.run(
      "settings",
      route,
      `Create/validate ${entity.label}; visible list updates without reload`,
      async () => {
        await h.nav(entity.label);
        await h.page
          .getByRole("button", { name: "Thêm mới", exact: true })
          .click();
        const d = await readyEditor(h);
        const key = entity.kind === "users" ? "username" : "name";
        await d.locator(`#settings-${key}`).fill("");
        await d.getByRole("button", { name: "Lưu", exact: true }).click();
        await expect(d.locator(`#settings-${key}`)).toHaveAttribute(
          "aria-invalid",
          "true",
        );
        if (entity.kind === "handling-departments") {
          const nameInput = d.locator("#settings-name");
          await expect(nameInput).toHaveAttribute("maxlength", "19");
          await nameInput.fill("Bộ phận có tên rất dài vượt giới hạn");
          expect(
            Array.from(await nameInput.inputValue()).length,
          ).toBeLessThanOrEqual(19);
        }
        const name = `${h.prefix}_${entity.suffix}`;
        if (entity.kind !== "users")
          await d.locator("#settings-name").fill(name);
        if (entity.kind === "positions") {
          await d
            .locator("#settings-description")
            .fill(`${h.prefix} Mô tả tiếng Việt ✓`);
          await multi(h, "Quyền hạn", "Xem yêu cầu");
          await multi(h, "Quyền hạn", "Phê duyệt yêu cầu");
          await d
            .getByRole("button", { name: "Quyền hạn", exact: true })
            .click();
          const permissionSearch = h.page.getByRole("searchbox", {
            name: "Search quyền hạn",
            exact: true,
          });
          if (await permissionSearch.isVisible())
            await permissionSearch.fill("can_hr_rec");
          const hrPermission = h.page.getByRole("button", {
            name: "can_hr_rec",
            exact: true,
            pressed: false,
          });
          if (await hrPermission.count()) {
            await hrPermission.click();
            h.secondaryHr = true;
          }
          await h.page.keyboard.press("Escape");
        }
        if (entity.kind === "teams")
          await h.choose(
            "Department",
            requireOwn(h, "requesting-departments").name,
            d,
          );
        if (entity.kind === "users") {
          const username = `${h.prefix.toLowerCase()}_user`;
          for (const [field, value] of Object.entries({
            username,
            msnv: `FE${h.prefix.slice(7)}`,
            last_name: "TEST",
            first_name: h.prefix,
            email: `${username}@example.invalid`,
          }))
            await d.locator(`#settings-${field}`).fill(value);
          await h.choose(
            "Department",
            requireOwn(h, "requesting-departments").name,
            d,
          );
          await h.choose("Team", requireOwn(h, "teams").name, d);
          await h.choose("Chức vụ", requireOwn(h, "positions").name, d);
          await saveEditor(h, username);
          h.own[entity.kind] = {
            name: `TEST ${h.prefix}`,
            username,
            active: true,
          };
          return;
        }
        if (entity.kind === "handling-departments") {
          await d
            .locator("#settings-group_email")
            .fill(`${h.prefix.toLowerCase()}@example.invalid`);
          await d
            .locator("#settings-description")
            .fill(`${h.prefix} UI handling fixture`);
          await d
            .getByRole("combobox", { name: "Người quản lý", exact: true })
            .click();
          await h.page
            .getByRole("combobox", { name: "Tìm người quản lý", exact: true })
            .fill(process.env.E2E_USERNAME!);
          await h.page
            .getByRole("option")
            .filter({ hasText: new RegExp(`^${process.env.E2E_USERNAME} ·`) })
            .first()
            .click();
          await multi(
            h,
            "Thành viên",
            `${requireOwn(h, "users").username} · ${requireOwn(h, "users").name}`,
          );
        }
        if (entity.kind === "request-types")
          await h.choose(
            "Bộ phận xử lý",
            requireOwn(h, "handling-departments").name,
            d,
          );
        await saveEditor(h, name);
        h.own[entity.kind] = { name, active: true };
      },
    );
    await h.run(
      "settings",
      route,
      `Update ${entity.label}, reopen and cancel without another save`,
      async () => {
        const original = requireOwn(h, entity.kind);
        let d = await editOwn(h, entity.kind);
        const field = entity.kind === "users" ? "first_name" : "name";
        const next =
          entity.kind === "users"
            ? `${h.prefix}_Updated`
            : `${original.name}_U`;
        await d.locator(`#settings-${field}`).fill(next);
        await saveEditor(h, original.username || next);
        h.own[entity.kind] = {
          ...original,
          name: entity.kind === "users" ? `TEST ${next}` : next,
        };
        d = await editOwn(h, entity.kind);
        await expect(d.locator(`#settings-${field}`)).toHaveValue(next);
        if (entity.kind === "users")
          await expect(d.locator("#settings-msnv")).toBeDisabled();
        await d.locator(`#settings-${field}`).fill(`${h.prefix}_UNSAVED`);
        await d.getByRole("button", { name: "Hủy", exact: true }).click();
        d = await editOwn(h, entity.kind);
        await expect(d.locator(`#settings-${field}`)).toHaveValue(next);
        await d.getByRole("button", { name: "Hủy", exact: true }).click();
      },
    );
  }
  await h.run(
    "settings",
    "/settings/positions",
    "Permission help stays mounted across responsive breakpoint and closes via keyboard",
    async () => {
      await h.nav("Chức vụ");
      await h.page
        .getByRole("button", { name: "Thông tin quyền hạn", exact: true })
        .click();
      const d = h.page.getByRole("dialog");
      const original = await d.elementHandle();
      for (const [width, height] of [
        [390, 844],
        [768, 1024],
        [1440, 900],
      ]) {
        await h.page.setViewportSize({ width, height });
        await expect(d).toBeVisible();
        expect(await original!.evaluate((element) => element.isConnected)).toBe(
          true,
        );
      }
      await h.page.keyboard.press("Escape");
      await expect(d).toHaveCount(0);
    },
  );
  await h.run(
    "settings",
    "/settings/request-types",
    "Template create and update text/number fields, flags, ordering and persistence in same session",
    async () => {
      const row = requireOwn(h, "request-types");
      await h.nav("Loại yêu cầu");
      await h.search(row.name);
      await h.page
        .getByRole("button", { name: `Biểu mẫu ${row.name}`, exact: true })
        .click();
      const d = h.page.getByRole("dialog");
      await expect(
        d.getByRole("form", { name: "Cấu hình biểu mẫu", exact: true }),
      ).toBeVisible();
      await d.getByRole("button", { name: "Thêm phần", exact: true }).click();
      await d
        .getByRole("button", { name: "Mở rộng phần 1", exact: true })
        .click();
      await d.locator("#template-group-0").fill(`${h.prefix} Nội dung`);
      for (const [index, type] of ["Văn bản", "Số"].entries()) {
        await d
          .getByRole("button", { name: "Thêm trường", exact: true })
          .click();
        await d
          .locator(`#template-0-${index}-title`)
          .fill(index ? "Số lượng" : "Nội dung");
        await d.locator(`#template-0-${index}-type`).click();
        await h.page.getByRole("option", { name: type, exact: true }).click();
      }
      await d
        .locator('label[for="template-0-0-required"]')
        .getByRole("checkbox")
        .click();
      await d
        .getByRole("button", { name: "Lưu biểu mẫu", exact: true })
        .click();
      await expect(d).toHaveCount(0);
      await expect(
        h.page.getByText("Đã lưu biểu mẫu.", { exact: true }),
      ).toBeVisible();
      await h.page
        .getByRole("button", { name: `Biểu mẫu ${row.name}`, exact: true })
        .click();
      await d
        .getByRole("button", { name: "Mở rộng phần 1", exact: true })
        .click();
      await expect(d.locator("#template-0-0-title")).toHaveValue("Nội dung");
      await expect(d.locator("#template-0-1-title")).toHaveValue("Số lượng");
      await d.locator("#template-group-0").fill(`${h.prefix} Đã cập nhật`);
      await d
        .getByRole("button", { name: "Lưu biểu mẫu", exact: true })
        .click();
      await expect(d).toHaveCount(0);
    },
  );
  h.note(
    "settings",
    "/settings/users/new",
    "Dedicated create-user URL",
    "The create modal is exercised via Thêm mới; the additional URL ingress is tested in the explicit direct-route phase.",
  );
}
export async function cleanupSettings(h: Harness) {
  for (const kind of [
    "request-types",
    "handling-departments",
    "users",
    "teams",
    "positions",
    "offices",
    "requesting-departments",
  ])
    await h.run(
      "settings",
      `/settings/${kind}`,
      `Lock own disposable ${kind} and verify Khóa badge through list/filter UI`,
      async () => {
        const row = requireOwn(h, kind);
        const d = await editOwn(h, kind);
        const checkbox = d.getByRole("checkbox").first();
        if ((await checkbox.getAttribute("aria-checked")) === "true")
          await checkbox.click();
        await saveEditor(h, row.username || row.name);
        await expect(
          h.page
            .getByRole("row")
            .filter({
              has: h.page.getByRole("button", {
                name: `Chỉnh sửa ${row.username || row.name}`,
                exact: true,
              }),
            })
            .getByText("Khóa", { exact: true }),
        ).toBeVisible();
        row.active = false;
      },
    );
  h.note(
    "settings",
    "/settings",
    "Delete catalog entities",
    "The settings UI implements activation/locking but no delete action; disposable fixtures were locked through UI instead.",
  );
}
