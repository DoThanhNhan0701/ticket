import { Harness, expect, Blocked } from "../harness";
import { menu } from "../discovery";

export async function listPage(h: Harness, item: (typeof menu)[number]) {
  const p = h.page;
  const result = await h.run(
    item.module,
    item.route,
    `Sidebar navigation: ${item.label}`,
    () => h.nav(item.label),
  );
  if (result !== "PASS") {
    for (const feature of [
      "Search and no-results",
      "Filters",
      "Pagination",
      "Row/detail actions",
      "Responsive",
      "Accessibility",
    ])
      h.note(
        item.module,
        item.route,
        feature,
        "The sidebar route is unavailable or did not load; see navigation outcome",
        "BLOCKED",
      );
    return;
  }
  await h.run(
    item.module,
    item.route,
    "Responsive desktop/tablet/mobile and no document horizontal overflow",
    () => h.responsive(),
  );
  await h.run(
    item.module,
    item.route,
    "Automated accessibility WCAG A/AA including contrast and labels",
    () => h.axe(),
  );
  if (
    item.route.includes("/settings/") ||
    [
      "/requests",
      "/requests/all",
      "/approvals/pending",
      "/approvals/approved",
      "/tasks",
      "/tasks/mine",
    ].includes(item.route)
  ) {
    await h.run(
      item.module,
      item.route,
      "Search draft, Enter submission, no-result state and clear",
      async () => {
        const search = p.getByRole("searchbox").first();
        if (!(await search.isVisible()))
          throw new Blocked("No searchable list UI rendered");
        const url = p.url();
        await search.fill(`NO_MATCH_${h.prefix}`);
        expect(p.url()).toBe(url);
        await search.press("Enter");
        await expect(
          p.getByText(/Không tìm thấy|Chưa có yêu cầu/).first(),
        ).toBeVisible();
        const clear = p.getByRole("button", { name: "Xóa lọc", exact: true });
        if (await clear.isVisible()) await clear.click();
        else {
          await search.fill("");
          await search.press("Enter");
        }
        await h.settle();
        await expect(search).toHaveValue("");
      },
    );
    await h.run(
      item.module,
      item.route,
      "Searchable status dropdown opens, searches, and Escape closes",
      async () => {
        await p
          .getByRole("combobox", { name: "Trạng thái", exact: true })
          .click();
        const search = p.getByRole("combobox", {
          name: "Tìm trạng thái",
          exact: true,
        });
        await search.fill(`NO_OPTION_${h.prefix}`);
        await expect(
          p.getByText("Không tìm thấy kết quả.", { exact: true }),
        ).toBeVisible();
        await p.keyboard.press("Escape");
        await expect(p.getByRole("listbox")).toHaveCount(0);
      },
    );
    await h.run(
      item.module,
      item.route,
      "Pagination page size and available next/previous preserve SPA",
      async () => {
        const next = p.getByRole("button", { name: "Trang sau", exact: true });
        if (!(await next.count()))
          throw new Blocked(
            "Pagination is hidden because the actual result set is empty",
          );
        await h.settle();
        const sizes = p.getByRole("combobox", { name: /^Số .* mỗi trang$/ });
        await sizes.click();
        await p
          .getByRole("option", { name: "200 / trang", exact: true })
          .click();
        await expect(p).toHaveURL(
          (url) => url.searchParams.get("page_size") === "200",
        );
        await h.settle();
        if (await next.isEnabled()) {
          await next.click();
          await expect(p).toHaveURL(
            (url) => url.searchParams.get("page") === "2",
          );
          await h.settle();
          await p
            .getByRole("button", { name: "Trang trước", exact: true })
            .click();
          await h.settle();
          return { nextPreviousExecuted: true };
        }
        return {
          nextPreviousExecuted: false,
          reason:
            "Actual filtered data fits on one 200-row page; boundary-disabled state verified",
          nextDisabled: true,
        };
      },
    );
    const drawer = p.getByRole("button", { name: "Lọc nâng cao", exact: true });
    if (await drawer.isVisible())
      await h.run(
        item.module,
        item.route,
        "Advanced-filter drawer cancel, Escape and focus return",
        async () => {
          await drawer.click();
          const dialog = p.getByRole("dialog");
          await expect(dialog).toBeVisible();
          await p.keyboard.press("Escape");
          await expect(dialog).toHaveCount(0);
          await expect(drawer).toBeFocused();
        },
      );
    h.note(
      item.module,
      item.route,
      "Column sorting / bulk actions",
      item.route.includes("/settings/")
        ? "Settings tables do not implement column sorting, row selection or bulk mutations."
        : "Request table sorting is intentionally disabled; available view/filter controls are tested separately.",
    );
  }
}
export async function shell(h: Harness) {
  await h.run(
    "accessibility",
    "/requests",
    "Document language matches the primary Vietnamese workspace UI",
    async () => {
      await expect(
        h.page.locator("html"),
        "Vietnamese workspace needs an appropriate document language for screen readers",
      ).toHaveAttribute("lang", /^vi(?:-|$)/);
    },
  );
  await h.run(
    "navigation",
    "/requests",
    "Sidebar collapse/expand and nested menu persistence",
    async () => {
      const p = h.page;
      const collapse = p.getByRole("button", {
        name: "Thu gọn sidebar",
        exact: true,
      });
      if (await collapse.isVisible()) {
        await collapse.click();
        await expect(
          p.getByRole("button", { name: "Mở rộng sidebar", exact: true }),
        ).toBeVisible();
        await p
          .getByRole("button", { name: "Mở rộng sidebar", exact: true })
          .click();
      }
      await expect(p.locator("#desktop-sidebar")).toBeVisible();
    },
  );
  await h.run(
    "navigation",
    "/requests",
    "Header logo, theme toggles and real browser history",
    async () => {
      const p = h.page;
      await p
        .getByRole("link", { name: "Rainscales Ticket home", exact: true })
        .click();
      await expect(p).toHaveURL(/\/requests(?:\?|$)/);
      const theme = p.getByRole("button", {
        name: /^Switch to (light|dark) theme$/,
      });
      const before = await theme.getAttribute("aria-label");
      await theme.click();
      await expect(theme).not.toHaveAttribute("aria-label", before!);
      await theme.click();
      await h.nav("Người dùng");
      await h.nav("Văn phòng");
      await p.goBack();
      await expect(p).toHaveURL(/\/settings\/users/);
      await p.goForward();
      await expect(p).toHaveURL(/\/settings\/offices/);
    },
  );
}
