import { Harness, expect, Blocked } from "../harness";

export async function interviewUi(h: Harness) {
  const p = h.page;
  const opened = await h.run(
    "recruitment",
    "/recruitment/interviews/:codeInterview",
    "Open existing DATA interview through calendar, read only",
    async () => {
      await h.nav("Lịch phỏng vấn");
      const target = p.getByRole("button", {
        name: "Xem CV lịch Phỏng vấn DATA",
        exact: true,
      });
      if (!(await target.isVisible().catch(() => false)))
        await expect(target)
          .toBeVisible({ timeout: 20000 })
          .catch(() => undefined);
      if (!(await target.count()))
        throw new Blocked(
          "The interview shown in the user screenshot is not present in the current calendar range; no existing data was modified",
        );
      await target.click();
      await expect(p).toHaveURL(/\/recruitment\/interviews\/[^/?]+/);
      await expect(
        p.getByRole("table", { name: "CV phỏng vấn", exact: true }),
      ).toBeVisible();
      h.visits.add("/recruitment/interviews/:codeInterview");
    },
  );
  if (opened !== "PASS") return;
  for (const [width, height] of [
    [320, 844],
    [390, 844],
    [768, 1024],
    [1440, 900],
  ]) {
    await h.run(
      "recruitment",
      "/recruitment/interviews/:codeInterview",
      `Interview CV ${width}px: readable columns, contained horizontal scroll, sticky row actions and pagination`,
      async () => {
        await p.setViewportSize({ width, height });
        await h.settle();
        const table = p.getByRole("table", {
          name: "CV phỏng vấn",
          exact: true,
        });
        const region = p.getByRole("region", {
          name: "Cuộn bảng tuyển dụng",
          exact: true,
        });
        const headers = table.getByRole("columnheader");
        await expect(headers).toHaveText([
          "#",
          "Họ và tên",
          "Ngày sinh",
          "Số điện thoại",
          "Email",
          "Giờ phỏng vấn",
          "Trạng thái CV",
          "Thao tác",
        ]);
        const geometry = await table.evaluate((el) => ({
          width: el.getBoundingClientRect().width,
          headers: Array.from(el.querySelectorAll("th")).map((th) => {
            const span = th.querySelector("span")!;
            return { available: span.clientWidth, text: span.scrollWidth };
          }),
        }));
        expect(geometry.width).toBeGreaterThanOrEqual(1140);
        for (const header of geometry.headers)
          expect(header.text).toBeLessThanOrEqual(header.available + 1);
        const doc = await p.evaluate(() => ({
          content: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }));
        expect(doc.content).toBeLessThanOrEqual(doc.viewport + 1);
        const rows = table.getByRole("row");
        expect(await rows.count()).toBeGreaterThan(1);
        const action = rows.nth(1).getByRole("button", { name: /^Thao tác / });
        await expect(action).toBeVisible();
        // Scroll only the table's real UI region, leaving the document in place.
        await region.hover();
        await p.mouse.wheel(1400, 0);
        if (width < 1140)
          await expect
            .poll(() => region.evaluate((el) => el.scrollLeft))
            .toBeGreaterThan(0);
        const bounds = await action.boundingBox();
        const viewport = await region.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(viewport!.x);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
          viewport!.x + viewport!.width + 1,
        );
        const status = rows.nth(1).getByRole("cell").nth(6).locator("span");
        expect(
          await status.evaluate((el) => el.getBoundingClientRect().height),
        ).toBeLessThan(36);
        await action.click();
        await expect(
          p.getByRole("dialog", { name: "Chọn thao tác", exact: true }),
        ).toBeVisible();
        await p
          .getByRole("button", { name: "Đóng chọn thao tác", exact: true })
          .click();
        await expect(
          p.getByRole("button", { name: "Trang trước", exact: true }),
        ).toBeDisabled();
        await expect(
          p.getByRole("button", { name: "Trang sau", exact: true }),
        ).toBeDisabled();
        await region.hover();
        await p.mouse.wheel(-1400, 0);
        await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBe(0);
        await p.screenshot({ path: `${h.root}/interview-${width}.png` });
      },
    );
  }
  await h.run(
    "recruitment",
    "/recruitment/interviews/:codeInterview",
    "Mobile filter drawer opens and cancels without changing candidate data",
    async () => {
      await p.setViewportSize({ width: 390, height: 844 });
      await p
        .getByRole("button", { name: "Tìm kiếm nâng cao", exact: true })
        .click();
      await expect(p.getByRole("dialog")).toBeVisible();
      await p.keyboard.press("Escape");
      await expect(p.getByRole("dialog")).toHaveCount(0);
      await h.axe();
      await p.setViewportSize({ width: 1440, height: 900 });
    },
  );
  await h.run(
    "recruitment",
    "/recruitment/interviews/:codeInterview",
    "Light theme mobile interview CV: readable status, no document overflow and accessibility",
    async () => {
      await p.setViewportSize({ width: 390, height: 844 });
      const light = p.getByRole("button", {
        name: "Switch to light theme",
        exact: true,
      });
      if (await light.isVisible()) await light.click();
      await expect(p.locator("html")).not.toHaveClass(/dark/);
      await h.axe();
      expect(
        await p.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
      ).toBe(true);
      await p.screenshot({ path: `${h.root}/interview-390-light.png` });
      await p.setViewportSize({ width: 1440, height: 900 });
    },
  );
}

export async function interviewerNamesUi(h: Harness) {
  await h.run(
    "recruitment",
    "/recruitment/interviews",
    "Calendar resolves assigned interviewer IDs to names on month/week/day cards",
    async () => {
      const p = h.page;
      await h.nav("Lịch phỏng vấn");
      await p.locator("#recruitment-filter-from").fill("23/10/2026");
      await p.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
      for (const view of ["Tháng", "Tuần", "Ngày"]) {
        await p.getByRole("button", { name: view, exact: true }).click();
        const card = p.getByRole("article", {
          name: "Phỏng vấn DATA",
          exact: true,
        });
        const names = card.getByRole("button", { name: /^Người phỏng vấn:/ });
        await expect(names).toBeVisible();
        await expect(names).not.toHaveAttribute(
          "aria-label",
          "Người phỏng vấn: —",
        );
        expect(
          (await names.getAttribute("aria-label"))!
            .replace("Người phỏng vấn:", "")
            .trim(),
        ).not.toBe("");
        await names.hover();
        await expect(p.getByRole("tooltip")).toBeVisible();
        await expect(p.getByRole("tooltip")).toContainText("Người phỏng vấn");
        await p.keyboard.press("Escape");
        await expect(
          card.getByRole("button", {
            name: "Sửa lịch Phỏng vấn DATA",
            exact: true,
          }),
        ).toBeEnabled();
      }
    },
  );
}
