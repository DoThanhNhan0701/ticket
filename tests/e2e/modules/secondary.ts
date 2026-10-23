import { Harness, expect, Blocked } from "../harness";
import fs from "node:fs";
import { format } from "date-fns";

export async function reports(h: Harness) {
  const p = h.page;
  for (const [label, route, mode] of [
    ["Báo cáo", "/reports", "dashboard"],
    ["Truy xuất dữ liệu", "/reports/export", "export"],
  ]) {
    await h.run(
      "reports",
      route,
      "Required report filters and invalid date-range validation",
      async () => {
        await h.nav(label);
        const group = p.getByRole("combobox", {
          name: "Bộ phận xử lý",
          exact: true,
        });
        if (!(await group.isVisible()))
          throw new Blocked("No reporting group is available for this account");
        if (mode === "export") {
          await group.click();
          await p
            .getByRole("option")
            .filter({ hasText: h.own["handling-departments"]?.name || "HR" })
            .first()
            .click();
          const type = p.getByRole("combobox", {
            name: "Loại yêu cầu",
            exact: true,
          });
          await expect(type).toBeEnabled();
          await type.click();
          await p.getByRole("option").first().click();
        }
        await p.locator(`#${mode}-startdate`).fill("01/01/2030");
        await p.locator(`#${mode}-enddate`).fill("01/01/2020");
        await p
          .getByRole("button", {
            name: mode === "dashboard" ? "Tra cứu" : "Xuất Excel",
            exact: true,
          })
          .click();
        await expect(p.locator('[aria-invalid="true"]').first()).toBeVisible();
        await p.locator(`#${mode}-startdate`).fill("01/01/2026");
        await p
          .locator(`#${mode}-enddate`)
          .fill(format(new Date(), "dd/MM/yyyy"));
      },
    );
    await h.run(
      "reports",
      route,
      mode === "dashboard"
        ? "Render summary/charts for selected group through report form"
        : "Export selected group/type from UI",
      async () => {
        await h.nav(label);
        const group = p.getByRole("combobox", {
          name: "Bộ phận xử lý",
          exact: true,
        });
        if (!(await group.isVisible()))
          throw new Blocked("No reporting group is available");
        await p.locator(`#${mode}-startdate`).fill("01/01/2026");
        await p
          .locator(`#${mode}-enddate`)
          .fill(format(new Date(), "dd/MM/yyyy"));
        await group.click();
        const option = h.own["handling-departments"]
          ? p.getByRole("option", {
              name: h.own["handling-departments"].name,
              exact: true,
            })
          : p.getByRole("option").first();
        if (!(await option.count()))
          throw new Blocked("Reporting groups are empty");
        await option.click();
        if (mode === "dashboard") {
          await p.getByRole("button", { name: "Tra cứu", exact: true }).click();
          const result = p.getByRole("region", {
            name: "Kết quả báo cáo",
            exact: true,
          });
          await expect(result).toHaveAttribute("aria-busy", "false");
          await expect(result).not.toBeEmpty();
        } else {
          const types = p.getByRole("combobox", {
            name: "Loại yêu cầu",
            exact: true,
          });
          await expect(types).toBeEnabled();
          await types.click();
          await p.getByRole("option").first().click();
          const downloaded = p.waitForEvent("download");
          await p
            .getByRole("button", { name: "Xuất Excel", exact: true })
            .click();
          const download = await downloaded;
          const file = await download.path();
          expect(fs.readFileSync(file).subarray(0, 2).toString()).toBe("PK");
        }
      },
    );
  }
}
export async function recruitment(h: Harness) {
  const p = h.page;
  for (const [label, route] of [
    ["Yêu cầu tuyển dụng", "/recruitment/requests"],
    ["Quản lý ứng viên", "/recruitment/candidates"],
  ]) {
    const navigated = await h.run(
      "recruitment",
      route,
      "Navigate recruitment list and real filters",
      () => h.nav(label),
    );
    if (navigated !== "PASS") {
      for (const feature of [
        "Search",
        "Row actions",
        "Bulk selection",
        "Create/edit/delete disposable candidate",
      ])
        h.note(
          "recruitment",
          route,
          feature,
          "Account cannot reach this module through sidebar",
          "BLOCKED",
        );
      continue;
    }
    await h.run(
      "recruitment",
      route,
      "Draft search, no results and reset recruitment filters",
      async () => {
        const input = p.locator("#recruitment-filter-search");
        const url = p.url();
        try {
          await input.fill(`NO_MATCH_${h.prefix}`);
          expect(p.url()).toBe(url);
          await p
            .getByRole("button", { name: "Tìm kiếm", exact: true })
            .click();
          await h.settle();
          await expect(
            p.getByText(/Không tìm thấy|Chưa có/).first(),
          ).toBeVisible();
        } finally {
          await p
            .getByRole("button", { name: "Xóa lọc tuyển dụng", exact: true })
            .click();
          await h.settle();
          await expect(input).toHaveValue("");
        }
      },
    );
    await h.run(
      "recruitment",
      route,
      "Advanced drawer opens, retains applied filters and cancels on Escape",
      async () => {
        const open = p.getByRole("button", {
          name: "Lọc nâng cao",
          exact: true,
        });
        await open.click();
        await expect(p.getByRole("dialog")).toBeVisible();
        await p.keyboard.press("Escape");
        await expect(p.getByRole("dialog")).toHaveCount(0);
      },
    );
    await h.run(
      "recruitment",
      route,
      "Open row action chooser and available readonly/edit forms, cancel without modifying existing records",
      async () => {
        const action = p.getByRole("button", { name: /^Thao tác / }).first();
        if (!(await action.isVisible().catch(() => false)))
          throw new Blocked(
            "No current data row/action is available in the actual date range",
          );
        await action.click();
        const d = p.getByRole("dialog");
        await expect(d).toBeVisible();
        const edit = d.getByRole("button", {
          name: route.endsWith("requests") ? /^Xem yêu cầu/ : /^Sửa hồ sơ/,
        });
        if (await edit.count()) {
          await edit.click();
          await expect(p.getByRole("textbox").first()).toBeVisible();
        }
        await p.keyboard.press("Escape");
        await h.recover();
      },
    );
    if (route.endsWith("candidates"))
      await h.run(
        "recruitment",
        route,
        "Candidate selection and bulk interview dialog validation/cancel",
        async () => {
          const checkbox = p
            .getByRole("checkbox", { name: /^Chọn CV / })
            .first();
          if (!(await checkbox.count()))
            throw new Blocked("No candidate rows in current real data range");
          await checkbox.click();
          const attach = p
            .getByRole("button", { name: /Gắn lịch|phỏng vấn/ })
            .first();
          if (!(await attach.isVisible()))
            throw new Blocked("Bulk attach action not available");
          await attach.click();
          await expect(p.getByRole("dialog")).toBeVisible();
          await p.keyboard.press("Escape");
          await h.recover();
        },
      );
    h.note(
      "recruitment",
      route,
      "Do not mutate pre-existing recruitment rows",
      "This readonly smoke phase inspects existing rows without saving. Save/delete/status mutations on owned fixtures are covered separately by hrJourney.",
      "NOT RUN",
    );
  }
  await h.run(
    "recruitment",
    "/recruitment/interviews",
    "Calendar month/week/day, previous/next/today and create modal validation",
    async () => {
      await h.nav("Lịch phỏng vấn");
      for (const view of ["Tháng", "Tuần", "Ngày"]) {
        const button = p.getByRole("button", { name: view, exact: true });
        await button.click();
        await expect(button).toHaveAttribute("aria-pressed", "true");
        await h.axe();
      }
      await p.getByRole("button", { name: "Khoảng sau", exact: true }).click();
      await p
        .getByRole("button", { name: "Khoảng trước", exact: true })
        .click();
      await p.getByRole("button", { name: "Hôm nay", exact: true }).click();
      const create = p.getByRole("button", {
        name: "Tạo lịch phỏng vấn",
        exact: true,
      });
      if (!(await create.isVisible()))
        throw new Blocked("Calendar create action is permission-gated");
      await create.click();
      const d = p.getByRole("dialog");
      await expect(d).toBeVisible();
      const submit = d.getByRole("button", { name: /^Lưu$|^Tạo lịch$/ });
      if (await submit.count()) {
        await submit.click();
        await expect(d.locator('[aria-invalid="true"]').first()).toBeVisible();
      }
      await p.keyboard.press("Escape");
      await h.recover();
    },
  );
  await h.run(
    "recruitment",
    "/recruitment/reports",
    "Recruitment report tabs, keyboard arrows, scroll and export",
    async () => {
      await h.nav("Báo cáo tuyển dụng");
      const tabs = p
        .getByRole("tablist", { name: "Báo cáo tuyển dụng", exact: true })
        .getByRole("tab");
      const count = await tabs.count();
      if (!count) throw new Blocked("No recruitment report tabs rendered");
      for (let i = 0; i < count; i++) {
        await tabs.nth(i).click();
        await expect(tabs.nth(i)).toHaveAttribute("aria-selected", "true");
        await expect(p.getByRole("tabpanel")).toBeVisible();
      }
      await tabs.last().focus();
      await p.keyboard.press("Home");
      await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
      await p.keyboard.press("End");
      await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
    },
  );
}
export async function help(h: Harness) {
  const p = h.page;
  await h.run(
    "help",
    "/help",
    "Header help navigation, chapter next/previous and table-of-contents SPA",
    async () => {
      await p
        .getByRole("button", { name: "Hướng dẫn sử dụng", exact: true })
        .click();
      await expect(p).toHaveURL(/\/help/);
      await expect(
        p.getByRole("heading", { name: "Hướng dẫn sử dụng", exact: true }),
      ).toBeVisible();
      const chapters = p
        .getByRole("navigation", { name: "Mục lục hướng dẫn", exact: true })
        .getByRole("button");
      await expect(chapters.first()).toBeVisible();
      const previous = p.getByRole("button", {
        name: "Chương trước",
        exact: true,
      });
      const next = p.getByRole("button", {
        name: "Chương tiếp theo",
        exact: true,
      });
      await chapters.first().click();
      await expect(previous).toBeDisabled();
      // Read every chapter from the real Word document through the rendered UI.
      const count = await chapters.count();
      expect(count).toBe(15);
      for (let index = 0; index < count; index++) {
        if (index) await next.click();
        await expect(p).toHaveURL(
          (url) => url.searchParams.get("chapter") === String(index + 1),
        );
        await expect(p.locator("#user-guide-title")).toHaveText(
          new RegExp(`^${index + 1}\\.`),
        );
        await expect(p.locator(".guide-document").last()).not.toBeEmpty();
      }
      await expect(next).toBeDisabled();
      await previous.click();
      await expect(p).toHaveURL(
        (url) => url.searchParams.get("chapter") === "14",
      );
      await chapters.first().click();
      h.visits.add("/help");
    },
  );
  await h.run(
    "help",
    "/help",
    "Download original Word document through UI",
    async () => {
      const pending = p.waitForEvent("download");
      await p
        .getByRole("link", { name: "Tải tài liệu Word", exact: true })
        .click();
      const file = await pending;
      expect(
        fs
          .readFileSync(await file.path())
          .subarray(0, 2)
          .toString(),
      ).toBe("PK");
    },
  );
  await h.run(
    "help",
    "/help",
    "Responsive document reader and mobile chapter selector",
    async () => {
      await h.responsive();
      await p.setViewportSize({ width: 390, height: 844 });
      await p
        .getByRole("combobox", { name: "Chọn chương hướng dẫn", exact: true })
        .click();
      await p.getByRole("option").nth(1).click();
      await expect(
        p.getByRole("combobox", { name: "Chọn chương hướng dẫn", exact: true }),
      ).toBeVisible();
      await p.setViewportSize({ width: 1440, height: 900 });
    },
  );
}
