import { Harness, expect } from "../harness";
import { cloneReset } from "./requests";
import { readyEditor, saveEditor } from "./settings";

export async function cloneRegression(h: Harness, title: string) {
  const prefix = title.split(" ")[0];
  expect(prefix).toMatch(/^TESTFE_[A-Z0-9]{6}$/);
  const restored: { label: string; name: string; active: boolean }[] = [];
  async function state(
    label: string,
    name: string,
    active: boolean,
    capture = false,
  ) {
    await h.nav(label);
    await h.search(name);
    await h.page
      .getByRole("button", { name: `Chỉnh sửa ${name}`, exact: true })
      .click();
    const dialog = await readyEditor(h);
    const checkbox = dialog.getByRole("checkbox").first();
    const current = (await checkbox.getAttribute("aria-checked")) === "true";
    if (capture) restored.push({ label, name, active: current });
    if (current !== active) {
      await checkbox.click();
      await saveEditor(h, name);
    } else
      await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  }
  try {
    for (const [label, suffix] of [
      ["Bộ phận xử lý", "XL"],
      ["Loại yêu cầu", "TYPE"],
    ])
      await h.run(
        "settings",
        "/settings",
        `Temporarily reactivate owned clone prerequisite ${suffix}`,
        () => state(label, `${prefix}_${suffix}_U`, true, true),
      );
    await h.nav("Danh sách yêu cầu");
    await h.search(title);
    const row = h.page.getByRole("row").filter({ hasText: title }).last();
    const code = row.getByRole("link").first();
    h.ticket = {
      title,
      code: await code.innerText(),
      href: (await code.getAttribute("href"))!,
    };
    await cloneReset(h);
  } finally {
    for (const fixture of restored.reverse())
      await h.run(
        "settings",
        "/settings",
        `Restore owned prerequisite state ${fixture.name}`,
        () => state(fixture.label, fixture.name, fixture.active),
      );
  }
}
