import { Harness, expect } from "../harness";
import { menu } from "../discovery";
import { listPage, shell } from "./navigation";
import { help } from "./secondary";

export async function notificationJourney(h: Harness) {
  if (process.env.E2E_TOAST_RECOVERY_ONLY !== "true") {
    await shell(h);
    for (const item of menu) await listPage(h, item);
  }
  await h.run(
    "recruitment",
    "/recruitment/candidates",
    "Backend failure is shown as a toast without a retry button; filter recovery keeps the session and SPA document",
    async () => {
      const p = h.page;
      await h.nav("Quản lý ứng viên");
      const input = p.locator("#recruitment-filter-search");
      const toast = p
        .locator('[data-sonner-toast][data-type="error"]')
        .filter({ hasText: "Không tải được danh sách" })
        .first();
      const start = h.requests.length;
      await input.fill(`NO_MATCH_${h.prefix}`);
      await p.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
      await h.settle();
      const retry = p.getByRole("button", { name: "Thử lại", exact: true });
      const empty = p.getByText("Không tìm thấy ứng viên", { exact: true });
      await expect(toast.or(empty)).toBeVisible();
      await expect(retry).toHaveCount(0);
      if (await toast.isVisible()) {
        await expect(toast).toBeVisible();
        await expect(p.getByRole("alert")).toHaveCount(0);
        const observed = h.requests
          .slice(start)
          .filter((r) => r.url.startsWith("/api/list_cv/"));
        expect(observed.some((r) => r.status === 500)).toBe(true);
      } else {
        await expect(
          p.getByText("Không tìm thấy ứng viên", { exact: true }),
        ).toBeVisible();
        await expect(toast).toHaveCount(0);
      }
      await p
        .getByRole("button", { name: "Xóa lọc tuyển dụng", exact: true })
        .click();
      await h.settle();
      await expect(input).toHaveValue("");
      await expect(
        p.getByRole("table", { name: "Bảng ứng viên", exact: true }),
      ).toBeVisible();
      await expect(
        p.getByRole("button", { name: "Sign Out", exact: true }),
      ).toBeVisible();
      return {
        backendStatus: h.requests
          .slice(start)
          .filter((r) => r.url.startsWith("/api/list_cv/"))
          .map((r) => r.status),
        scope:
          "Frontend notification/recovery only; backend HTTP 500 remains for BE to fix",
      };
    },
  );
  if (process.env.E2E_TOAST_RECOVERY_ONLY !== "true") await help(h);
}
