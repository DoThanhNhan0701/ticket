import { format } from "date-fns";
import { Harness, expect, Blocked } from "../harness";

export async function duplicateUi(h: Harness) {
  const p = h.page;
  const dialog = p.locator('[role="dialog"][data-editor-action="duplicate"]');
  const opened = await h.run(
    "recruitment",
    "/recruitment/candidates",
    "Open real duplicate lookup through candidate row actions, read only",
    async () => {
      await h.nav("Quản lý ứng viên");
      await p
        .locator("#recruitment-filter-search")
        .fill(process.env.E2E_DUPLICATE_SEARCH || "0900000000");
      await p
        .getByRole("button", { name: "Lọc nâng cao", exact: true })
        .click();
      const filter = p.getByRole("dialog");
      await filter.locator("#recruitment-filter-from").fill("01/01/2025");
      await filter
        .locator("#recruitment-filter-to")
        .fill(format(new Date(), "dd/MM/yyyy"));
      await filter
        .getByRole("button", { name: "Áp dụng bộ lọc", exact: true })
        .click();
      await expect(filter).toHaveCount(0);
      await h.settle();
      const rows = p
        .getByRole("row")
        .filter({ has: p.getByRole("button", { name: /^Thao tác / }) });
      const count = await rows.count();
      if (!count)
        throw new Blocked(
          "No existing candidate matches the duplicate search/date range; no records were changed",
        );
      const target = rows.filter({ hasText: "CV_250701_155" });
      const preferred = (await target.count()) > 0;
      // Read a bounded selection of existing records; never create duplicates to satisfy a layout check.
      const indices = [
        ...new Set([
          ...Array.from({ length: Math.min(count, 12) }, (_, i) => i),
          ...Array.from(
            { length: Math.min(count, 12) },
            (_, i) => count - 1 - i,
          ),
        ]),
      ];
      let attempted = 0;
      for (const index of indices) {
        const row =
          preferred && attempted === 0 ? target.first() : rows.nth(index);
        await row.getByRole("button", { name: /^Thao tác / }).click();
        await p
          .getByRole("dialog", { name: "Chọn thao tác", exact: true })
          .getByRole("button", { name: /^Kiểm tra trùng / })
          .click();
        await expect(dialog).toBeVisible();
        const table = dialog.getByRole("table", {
          name: "Hồ sơ trùng",
          exact: true,
        });
        const empty = dialog.getByText("Không tìm thấy hồ sơ trùng lặp.", {
          exact: true,
        });
        await expect(table.or(empty).first()).toBeVisible();
        attempted++;
        if (await table.count())
          return {
            existingCandidatesChecked: attempted,
            result: "Populated duplicate results found through UI; no writes",
          };
        await dialog
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        await p
          .getByRole("button", { name: "Đóng chọn thao tác", exact: true })
          .click();
      }
      throw new Blocked(
        `No duplicate results in ${attempted} existing candidates; no records were changed`,
      );
    },
  );
  if (opened === "PASS") {
    for (const width of [320, 390, 768, 1440]) {
      await h.run(
        "recruitment",
        "/recruitment/candidates",
        `Duplicate lookup ${width}px: nine ticketV2 data columns, readable headers and contained table scroll`,
        async () => {
          await p.setViewportSize({
            width,
            height: width === 768 ? 1024 : 900,
          });
          const table = dialog.getByRole("table", {
            name: "Hồ sơ trùng",
            exact: true,
          });
          await expect(table.getByRole("columnheader")).toHaveText([
            "STT",
            "Mã CV",
            "Mã yêu cầu",
            "Số điện thoại",
            "Email",
            "Họ và tên",
            "Ngày sinh",
            "Trạng thái CV",
            "Ngày tạo",
          ]);
          expect(await table.getByRole("row").count()).toBeGreaterThan(1);
          const cells = table.getByRole("row").nth(1).getByRole("cell");
          await expect(cells).toHaveCount(9);
          await expect(cells.first()).toHaveText("1");
          const sizes = await table
            .getByRole("columnheader")
            .evaluateAll((headers) =>
              headers.map((header) => {
                const text = header.querySelector("span")!;
                return { width: text.clientWidth, content: text.scrollWidth };
              }),
            );
          for (const size of sizes)
            expect(size.content).toBeLessThanOrEqual(size.width + 1);
          expect(
            await p.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth + 1,
            ),
          ).toBe(true);
          const scroll = dialog.getByRole("region", {
            name: "Cuộn bảng tuyển dụng",
            exact: true,
          });
          await scroll.hover();
          await p.mouse.wheel(1800, 0);
          await expect
            .poll(() => scroll.evaluate((el) => el.scrollLeft))
            .toBeGreaterThan(0);
          await expect(
            dialog.getByRole("button", { name: "Close dialog", exact: true }),
          ).toBeVisible();
          await h.axe();
        },
      );
    }
  }
  await h.recover();
  await p.setViewportSize({ width: 1440, height: 900 });
}
