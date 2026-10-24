import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { format, subDays } from "date-fns";
import { Harness, expect, Blocked } from "../harness";
import { editOwn, saveEditor } from "./settings";
import { pdfFile } from "./hr";
import { openTicket, cleanupRequest } from "./requests";

// Chapter references match the original Word manual, not guessed route coverage.
export async function guideSettings(h: Harness) {
  const p = h.page;
  await h.run(
    "settings",
    "/settings/request-types",
    "Guide 12.6: reject non-PDF, upload/reopen own type manual",
    async () => {
      const d = await editOwn(h, "request-types");
      await d.locator("#settings-attachment").setInputFiles({
        name: "invalid.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("invalid"),
      });
      await expect(
        d.getByText("Vui lòng chọn tệp PDF.", { exact: true }),
      ).toBeVisible();
      await d
        .locator("#settings-attachment")
        .setInputFiles(pdfFile(h.prefix, "manual"));
      await expect(
        d.getByText("Vui lòng chọn tệp PDF.", { exact: true }),
      ).toHaveCount(0);
      await saveEditor(h, h.own["request-types"].name);
      const reopened = await editOwn(h, "request-types");
      await expect(
        reopened.getByRole("link", {
          name: "Xem tài liệu hiện tại",
          exact: true,
        }),
      ).toHaveAttribute("href", /\.pdf(?:\?|$)/i);
      await reopened.getByRole("button", { name: "Hủy", exact: true }).click();
    },
  );
  await h.run(
    "settings",
    "/settings/users",
    "Guide 12.8: export filtered own user through UI",
    async () => {
      await h.nav("Người dùng");
      await h.search(h.own.users.username!);
      const pending = p.waitForEvent("download");
      await p.getByRole("button", { name: "Xuất Excel", exact: true }).click();
      const downloaded = await pending;
      expect(await downloaded.failure()).toBeNull();
      expect(
        fs
          .readFileSync(await downloaded.path())
          .subarray(0, 2)
          .toString(),
      ).toBe("PK");
    },
  );
}

export async function guideRequest(h: Harness) {
  const p = h.page,
    source = h.ticket;
  if (!source) {
    h.note(
      "requests",
      "/requests/new",
      "Guide prerequisites",
      "Owned source request was not created",
      "BLOCKED",
    );
    return;
  }
  // Mentions target only the disposable colleague created by this run.
  await h.run(
    "requests",
    "/requests/:ticketID",
    "Guide 8.1: keyboard @ mention selects without prematurely sending; persisted comment",
    async () => {
      await openTicket(h);
      await p.getByRole("tab", { name: /^Trao đổi/ }).click();
      const form = p.getByRole("form", { name: "Phản hồi mới", exact: true });
      const input = form.getByRole("textbox");
      const username = h.own.users.username!;
      const text = `${h.prefix} mention `;
      await input.fill(`${text}@${username}`);
      const list = p.getByRole("listbox", {
        name: "Người dùng được gắn thẻ",
        exact: true,
      });
      await expect(
        list.getByRole("option").filter({ hasText: `@${username}` }),
      ).toBeVisible();
      await input.press("ArrowDown");
      await input.press("Enter");
      await expect(input).toHaveValue(`${text}@${username} `);
      await expect(
        p.getByRole("article").filter({ hasText: text }),
      ).toHaveCount(0);
      await input.pressSequentially("kiểm tra hướng dẫn");
      await form
        .getByRole("button", { name: "Gửi phản hồi", exact: true })
        .click();
      await expect(
        p
          .getByRole("article")
          .filter({ hasText: `${text}@${username} kiểm tra hướng dẫn` }),
      ).toBeVisible();
      await openTicket(h);
      await p.getByRole("tab", { name: /^Trao đổi/ }).click();
      await expect(
        p
          .getByRole("article")
          .filter({ hasText: `${text}@${username} kiểm tra hướng dẫn` }),
      ).toBeVisible();
    },
  );
  const cloned = await h.run(
    "requests",
    "/requests/new",
    "Guide 5.2 / 12.6: clone owned source, new date/files and type manual available",
    async () => {
      await openTicket(h);
      await p.getByRole("button", { name: "Sao chép", exact: true }).click();
      await expect(p.locator("#create-title")).toHaveValue(source.title);
      await expect(
        p.getByRole("link", { name: "Tài liệu hướng dẫn", exact: true }),
      ).toBeVisible();
      await expect(p.getByRole("button", { name: /^Bỏ tệp / })).toHaveCount(0);
      await p.locator("#create-title").fill(`${h.prefix} Sao chép Excel`);
    },
  );
  if (cloned !== "PASS") return;
  await h.run(
    "requests",
    "/requests/new",
    "Guide 4.3 / 15.2: title 300/301, notes 1000/1001 and past due-date validation before submit",
    async () => {
      const title = p.locator("#create-title"),
        notes = p.locator("#create-description"),
        date = p.locator("#create-due-date");
      await title.fill("T".repeat(301));
      await expect(title).toHaveAttribute("maxlength", "300");
      expect((await title.inputValue()).length).toBe(300);
      await title.fill("T".repeat(300));
      await title.blur();
      await expect(title).toHaveAttribute("aria-invalid", "false");
      await title.fill(`${h.prefix} Sao chép Excel`);
      await notes.fill("G".repeat(1001));
      await p.getByRole("button", { name: "Tạo yêu cầu", exact: true }).click();
      await expect(notes).toHaveAttribute("aria-invalid", "true");
      await notes.fill("G".repeat(1000));
      await notes.blur();
      await expect(notes).toHaveAttribute("aria-invalid", "false");
      const current = await date.inputValue();
      await date.fill(format(subDays(new Date(), 1), "dd/MM/yyyy"));
      await date.blur();
      await expect(date).toHaveAttribute("aria-invalid", "true");
      await date.fill(current);
      await date.blur();
      await notes.fill(`${h.prefix} Excel imported from downloaded template`);
    },
  );
  await h.run(
    "requests",
    "/requests/new",
    "Guide 4.5: download matching Excel, reject wrong extension preserving rows, import two real rows with numeric zero",
    async () => {
      const pending = p.waitForEvent("download");
      await p.getByRole("button", { name: "Tải mẫu", exact: true }).click();
      const downloaded = await pending;
      const original = path.join(h.root, "guide-template.xlsx");
      await downloaded.saveAs(original);
      expect(fs.readFileSync(original).subarray(0, 2).toString()).toBe("PK");
      const first = await p.locator("#detail-0-f0").inputValue();
      const upload = p.getByLabel("Nhập chi tiết từ Excel", { exact: true });
      await upload.setInputFiles({
        name: "wrong.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("bad"),
      });
      await expect(
        p.getByText("Vui lòng chọn tệp Excel .xlsx.", { exact: true }).first(),
      ).toBeVisible();
      await expect(p.locator("#detail-0-f0")).toHaveValue(first);
      const filled = path.join(h.root, "guide-filled.xlsx");
      execFileSync(process.env.PYTHON_EXECUTABLE || "python3", [
        "tests/browser/fill-guide-workbook.py",
        original,
        filled,
        h.prefix,
      ]);
      await upload.setInputFiles(filled);
      await expect(p.locator("#detail-0-f0")).toHaveValue(
        `${h.prefix} Excel 1`,
      );
      await expect(p.locator("#detail-0-f1")).toHaveValue("0");
      await expect(p.locator("#detail-1-f0")).toHaveValue(
        `${h.prefix} Excel 2`,
      );
      await expect(p.locator("#detail-1-f1")).toHaveValue("2");
    },
  );
  await h.run(
    "requests",
    "/requests/new",
    "Guide 4.6: remove mistakenly selected attachment before actual cloned submit",
    async () => {
      const upload = p.getByRole("form").locator('input[type="file"]').last();
      const file = pdfFile(h.prefix, "discard");
      await upload.setInputFiles(file);
      await p
        .getByRole("button", { name: `Bỏ tệp ${file.name}`, exact: true })
        .click();
      await expect(p.getByText(file.name, { exact: true })).toHaveCount(0);
    },
  );
  await h.run(
    "requests",
    "/requests/new",
    "Guide 5.2 / 4.7: submit cloned Excel request, different code, persisted rows, source unchanged",
    async () => {
      if ((await p.locator("#detail-1-f0").count()) === 0)
        throw new Blocked(
          "Real Excel import did not produce two rows; do not submit substitute data",
        );
      await p.locator("#create-title").fill(`${h.prefix} Sao chép Excel`);
      await p
        .locator("#create-description")
        .fill(`${h.prefix} Excel imported from downloaded template`);
      await p.getByRole("button", { name: "Tạo yêu cầu", exact: true }).click();
      await expect(p).toHaveURL(/\/requests(?:\?|$)/);
      const title = `${h.prefix} Sao chép Excel`;
      await h.search(title);
      const row = p
        .getByRole("row")
        .filter({ has: p.getByRole("link", { name: title, exact: true }) });
      const link = row.getByRole("link").first();
      await expect(link).toBeVisible();
      h.ticket = {
        title,
        code: await link.innerText(),
        href: (await link.getAttribute("href"))!,
      };
      expect(h.ticket.code).not.toBe(source.code);
      await link.click();
      await p
        .getByRole("tab", { name: "Chi tiết yêu cầu", exact: true })
        .click();
      await expect(
        p.getByText(`${h.prefix} Excel 1`, { exact: true }),
      ).toBeVisible();
      await expect(
        p.getByText(`${h.prefix} Excel 2`, { exact: true }),
      ).toBeVisible();
    },
  );
  if (h.ticket !== source) await cleanupRequest(h);
  h.ticket = source;
  await h.run(
    "requests",
    "/requests/:ticketID",
    "Guide 5.1: source request stays unchanged after clone submit",
    async () => {
      await openTicket(h);
      await p
        .getByRole("tab", { name: "Chi tiết yêu cầu", exact: true })
        .click();
      await expect(
        p.getByText(`${h.prefix} Nội dung thử`, { exact: true }),
      ).toBeVisible();
    },
  );
}

export async function guideReports(h: Harness) {
  await h.run(
    "recruitment",
    "/recruitment/reports",
    "Guide 11.6 / 15.2: require two dates, reject reversed and over-six-month report ranges, recover valid range",
    async () => {
      const p = h.page;
      await h.nav("Báo cáo tuyển dụng");
      const from = p.locator("#recruitment-filter-from"),
        to = p.locator("#recruitment-filter-to");
      const originalFrom = await from.inputValue(),
        originalTo = await to.inputValue();
      try {
        await from.fill("");
        await to.fill("");
        await p.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
        await expect(from).toHaveAttribute("aria-invalid", "true");
        await from.fill("22/10/2026");
        await p.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
        await expect(to).toHaveAttribute("aria-invalid", "true");
        await from.fill("23/10/2026");
        await to.fill("22/10/2026");
        await p.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
        await expect(to).toHaveAttribute("aria-invalid", "true");
        await from.fill("01/01/2026");
        await to.fill("23/10/2026");
        await p.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
        await expect(p.getByText(/6 tháng|sáu tháng/).first()).toBeVisible();
      } finally {
        await from.fill(originalFrom);
        await to.fill(originalTo);
        await p.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
        await h.settle();
      }
      await expect(from).toHaveAttribute("aria-invalid", "false");
      await expect(to).toHaveAttribute("aria-invalid", "false");
    },
  );
}
