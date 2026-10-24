import { Harness, expect, Blocked } from "../harness";
import { requireOwn } from "./settings";
const textFile = (h: Harness, suffix: string) => ({
  name: `${h.prefix}_${suffix}_tiếng-Việt.txt`,
  mimeType: "text/plain",
  buffer: Buffer.from(`${h.prefix}: ${suffix}`),
});
const imageFile = (h: Harness) => ({
  name: `${h.prefix}_ảnh.png`,
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWQAAAABJRU5ErkJggg==",
    "base64",
  ),
});
export async function openTicket(h: Harness) {
  if (!h.ticket)
    throw new Blocked("No disposable request was created through UI");
  await h.nav(h.secondaryActor ? "Nhiệm vụ cá nhân" : "Danh sách yêu cầu");
  await h.search(h.ticket.title);
  await h.page.getByRole("link", { name: h.ticket.code, exact: true }).click();
  await expect(
    h.page.getByRole("tab", { name: "Thông tin chung", exact: true }),
  ).toBeVisible();
  h.visits.add("/requests/:ticketID");
}
async function expectCreateStepAtBottom(h: Harness, step: number) {
  await expect(h.page.locator(`[data-request-step="${step}"]`)).toBeVisible();
  await expect
    .poll(
      () =>
        h.page
          .locator("main")
          .evaluate((main) =>
            Math.abs(main.scrollHeight - main.clientHeight - main.scrollTop),
          ),
      {
        timeout: 10000,
        message: `Step ${step} scrolls to the actual content bottom`,
      },
    )
    .toBeLessThanOrEqual(1);
}

export async function requestJourney(h: Harness) {
  const p = h.page;
  await longNameGuard(h);
  await h.run(
    "requests",
    "/requests/new",
    "Create form required fields, dependent selects, Unicode, rows, file preview and actual submit",
    async () => {
      await h.nav("Danh sách yêu cầu");
      const link = p.getByRole("link", { name: "Tạo yêu cầu", exact: true });
      if (!(await link.isVisible()))
        throw new Blocked("Create-request link is not permitted");
      await link.click();
      await expect(p).toHaveURL(/\/requests\/new/);
      h.visits.add("/requests/new");
      const form = p.getByRole("form", {
        name: "Tạo yêu cầu mới",
        exact: true,
      });
      await expect(form).toBeVisible();
      await expect(p.locator('[data-request-step="2"]')).toHaveCount(0);
      await p.getByRole("button", { name: "Tạo yêu cầu", exact: true }).click();
      await expect(p.locator("#create-handling_group")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await h.choose(
        "Bộ phận xử lý",
        requireOwn(h, "handling-departments").name,
      );
      await h.choose("Loại yêu cầu", requireOwn(h, "request-types").name);
      await h.choose(
        "Người phê duyệt",
        h.primaryName || requireOwn(h, "users").name,
      );
      const company = p.getByRole("combobox", { name: "Công ty", exact: true });
      await company.click();
      await p.getByRole("option").first().click();
      await expectCreateStepAtBottom(h, 2);
      const title = `${h.prefix} Yêu cầu tiếng Việt ✓`;
      await p.locator("#create-title").fill(title);
      await h.choose(
        "Department",
        requireOwn(h, "requesting-departments").name,
      );
      await h.choose("Văn phòng", requireOwn(h, "offices").name);
      await expectCreateStepAtBottom(h, 3);
      await p.locator("#detail-0-f0").fill(`${h.prefix} Nội dung thử`);
      await p.locator("#detail-0-f1").fill("0");
      await expectCreateStepAtBottom(h, 4);
      await p
        .getByRole("button", { name: "Sao chép dòng 1", exact: true })
        .click();
      await expect(p.locator("#detail-1-f1")).toHaveValue("0");
      await p.getByRole("button", { name: "Xóa dòng 2", exact: true }).click();
      await p.locator("#create-description").fill(`${h.prefix} Ghi chú`);
      await form
        .locator('input[type="file"]')
        .last()
        .setInputFiles([textFile(h, "create"), imageFile(h)]);
      await p
        .getByRole("button", {
          name: `Xem ảnh ${imageFile(h).name}`,
          exact: true,
        })
        .click();
      await expect(p.getByRole("dialog").getByRole("img")).toBeVisible();
      await p.keyboard.press("Escape");
      await p.getByRole("button", { name: "Tạo yêu cầu", exact: true }).click();
      await expect(p).toHaveURL(/\/requests(?:\?|$)/);
      await h.search(title);
      const row = p
        .getByRole("row")
        .filter({ has: p.getByRole("link", { name: title, exact: true }) });
      const codeLink = row.getByRole("link").first();
      await expect(codeLink).toBeVisible();
      h.ticket = {
        title,
        code: await codeLink.innerText(),
        href: (await codeLink.getAttribute("href"))!,
      };
      await codeLink.click();
      await expect(p.getByText(title, { exact: true })).toBeVisible();
    },
  );
  await h.run(
    "requests",
    "/requests/:ticketID",
    "Detail tabs, attachments, saved image preview and no state reset",
    async () => {
      await openTicket(h);
      await p
        .getByRole("tab", { name: "Thông tin chung", exact: true })
        .click();
      await expect(
        p.getByRole("link", { name: textFile(h, "create").name, exact: true }),
      ).toBeVisible();
      await p
        .getByRole("button", { name: imageFile(h).name, exact: true })
        .click();
      await expect
        .poll(() =>
          p
            .getByRole("dialog")
            .getByRole("img")
            .evaluate((image) => (image as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      await p.keyboard.press("Escape");
      for (const tab of [
        "Chi tiết yêu cầu",
        "Lịch sử",
        "Trao đổi",
        "Thông tin chung",
      ]) {
        await p.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
        await expect(
          p.getByRole("tab", { name: new RegExp(`^${tab}`) }),
        ).toHaveAttribute("aria-selected", "true");
      }
    },
  );
  await h.run(
    "requests",
    "/requests/:ticketID",
    "Comment validation clears live; pending files/draft survive tab switches and Stay warning",
    async () => {
      await openTicket(h);
      await p.getByRole("tab", { name: /^Trao đổi/ }).click();
      const form = p.getByRole("form", { name: "Phản hồi mới", exact: true });
      const input = form.getByRole("textbox");
      await form
        .getByRole("button", { name: "Gửi phản hồi", exact: true })
        .click();
      await expect(
        form.getByText("Vui lòng nhập phản hồi.", { exact: true }),
      ).toBeVisible();
      await input.fill(`${h.prefix} draft`);
      await expect(input).toHaveAttribute("aria-invalid", "false");
      await expect(
        form.getByText("Vui lòng nhập phản hồi.", { exact: true }),
      ).toHaveCount(0);
      await form
        .locator('input[type="file"]')
        .setInputFiles(textFile(h, "draft"));
      for (const tab of [
        "Thông tin chung",
        "Chi tiết yêu cầu",
        "Lịch sử",
        "Trao đổi",
      ])
        await p.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
      await expect(input).toHaveValue(`${h.prefix} draft`);
      await p
        .locator("#desktop-sidebar")
        .getByRole("link", { name: "Danh sách yêu cầu", exact: true })
        .click();
      const warning = p.getByRole("dialog", {
        name: "Tệp đính kèm chưa được gửi",
        exact: true,
      });
      await expect(warning).toBeVisible();
      await warning.getByRole("button", { name: "Ở lại", exact: true }).click();
      await expect(input).toHaveValue(`${h.prefix} draft`);
      await form
        .getByRole("button", {
          name: `Bỏ tệp ${textFile(h, "draft").name}`,
          exact: true,
        })
        .click();
      await input.fill("");
    },
  );
  await h.run(
    "requests",
    "/requests/:ticketID",
    "Send comment using Enter; Shift+Enter, attachment, reply and edit UI",
    async () => {
      await openTicket(h);
      await p.getByRole("tab", { name: /^Trao đổi/ }).click();
      const form = p.getByRole("form", { name: "Phản hồi mới", exact: true });
      const input = form.getByRole("textbox");
      const content = `${h.prefix} Comment`;
      await input.fill(content);
      await input.press("Shift+Enter");
      await input.pressSequentially("Dòng hai");
      await expect(input).toHaveValue(`${content}\nDòng hai`);
      await form
        .locator('input[type="file"]')
        .setInputFiles(textFile(h, "comment"));
      await input.press("Enter");
      const article = p.getByRole("article").filter({ hasText: content });
      await expect(article).toBeVisible();
      await expect(input).toHaveValue("");
      await article.hover();
      await article
        .getByRole("button", { name: "Trả lời", exact: true })
        .click();
      const reply = p.getByRole("form", { name: /^Trả lời .* mới$/ });
      await reply.getByRole("textbox").fill(`${h.prefix} Reply`);
      await reply
        .getByRole("button", { name: "Gửi phản hồi", exact: true })
        .click();
      await expect(
        p.getByText(`${h.prefix} Reply`, { exact: true }),
      ).toBeVisible();
      await article.hover();
      await article
        .getByRole("button", { name: /^Chỉnh sửa phản hồi của / })
        .click();
      const d = p.getByRole("dialog", {
        name: "Chỉnh sửa bình luận",
        exact: true,
      });
      await d.getByRole("textbox").fill(`${h.prefix} Edited`);
      await d
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await expect(d).toHaveCount(0);
      await expect(
        p.getByText(`${h.prefix} Edited`, { exact: true }),
      ).toBeVisible();
    },
  );
  await h.run(
    "requests",
    "/requests/:ticketID",
    "Responsive detail and keyboard accessible discussion",
    async () => {
      await openTicket(h);
      await p.getByRole("tab", { name: /^Trao đổi/ }).click();
      return h.responsive();
    },
  );
  await cloneReset(h);
  await h.run(
    "requests",
    "/requests/change-status",
    "Change-status required validation, searchable status and Unicode reason draft",
    async () => {
      await h.nav("Chuyển trạng thái yêu cầu");
      await p.getByRole("button", { name: "Cập nhật", exact: true }).click();
      await expect(p.locator("#change-status-code")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await p.locator("#change-status-reason").fill(`${h.prefix} Lý do thử ✓`);
      await p
        .getByRole("combobox", { name: "Trạng thái", exact: true })
        .click();
      await expect(p.getByRole("option").first()).toBeVisible();
      await p.keyboard.press("Escape");
    },
  );
}
export async function cleanupRequest(h: Harness) {
  if (h.closedTicket) {
    await h.run(
      "requests",
      "/requests/:ticketID",
      "Verify own lifecycle request remains closed during cleanup",
      async () => {
        await openTicket(h);
        await expect(
          h.page.getByRole("group", { name: "Thao tác yêu cầu", exact: true }),
        ).toHaveCount(0);
        await expect(
          h.page.getByRole("button", {
            name: "Đổi ngày mong muốn",
            exact: true,
          }),
        ).toHaveCount(0);
      },
    );
    return;
  }
  await h.run(
    "requests",
    "/requests/:ticketID",
    "Cancel own disposable request with required reason and visible final status",
    async () => {
      await openTicket(h);
      const cancel = h.page.getByRole("button", { name: "Hủy", exact: true });
      if (!(await cancel.isVisible()))
        throw new Blocked(
          "Cancel action is not available for the current request state/account",
        );
      await cancel.click();
      const d = h.page.getByRole("dialog");
      await d.getByRole("textbox").fill(`${h.prefix} E2E finished`);
      await d.getByRole("button", { name: "Hủy", exact: true }).click();
      await expect(d).toHaveCount(0);
      await expect(
        h.page.getByText("Hủy", { exact: true }).first(),
      ).toBeVisible();
    },
  );
}

export async function cloneReset(h: Harness) {
  const p = h.page;
  await h.run(
    "requests",
    "/requests/new",
    "Clone request through UI and reset discards cloned fields",
    async () => {
      await openTicket(h);
      await p.getByRole("button", { name: "Sao chép", exact: true }).click();
      await expect(p).toHaveURL(
        (url) =>
          url.pathname === "/requests/new" && url.searchParams.has("clone"),
      );
      const approver = p.getByRole("combobox", {
        name: "Người phê duyệt",
        exact: true,
      });
      // Cleanup may have locked the original approver; choose a valid replacement in the unsaved clone.
      if ((await approver.innerText()).includes("Chọn người phê duyệt")) {
        await approver.click();
        await p.getByRole("option").first().click();
      }
      await expect(p.locator("#create-title")).toHaveValue(h.ticket!.title);
      await p.getByRole("button", { name: "Làm lại", exact: true }).click();
      await expect(p).toHaveURL(
        (url) =>
          url.pathname === "/requests/new" && !url.searchParams.has("clone"),
      );
      await expect(p.locator("#create-handling_group")).toHaveText(
        "Chọn bộ phận xử lý",
      );
      // Request details are conditional on a selected group/type, so reset hides the title field.
      await expect(p.locator("#create-title")).toHaveCount(0);
      await h.nav("Danh sách yêu cầu");
    },
  );
}

export async function longNameGuard(h: Harness) {
  const p = h.page;
  await h.run(
    "requests",
    "/requests/new",
    "Reject legacy long handling group immediately, prevent submit and recover via valid selection",
    async () => {
      await h.nav("Danh sách yêu cầu");
      await p.getByRole("link", { name: "Tạo yêu cầu", exact: true }).click();
      const countBefore = h.requests.filter(
        (r) => r.method === "POST" && r.url === "/api/ticket_manager",
      ).length;
      await p
        .getByRole("combobox", { name: "Bộ phận xử lý", exact: true })
        .click();
      const names = await p.getByRole("option").allTextContents();
      const longName = names.find(
        (name) => Array.from(name.trim()).length > 19,
      );
      if (!longName) {
        await p.keyboard.press("Escape");
        throw new Blocked(
          "No active legacy handling group with a name longer than 19 characters exists; UI now prevents creating one. Immediate rejection is covered by the component regression test.",
        );
      }
      await p
        .getByRole("option", { name: longName.trim(), exact: true })
        .click();
      await expect(
        p.getByText(/Tên bộ phận xử lý quá dài.*19 ký tự/),
      ).toBeVisible();
      await expect(
        p.getByRole("button", { name: "Tạo yêu cầu", exact: true }),
      ).toBeDisabled();
      await expect(p.locator("#create-title")).toHaveCount(0);
      await p
        .getByRole("button", { name: "Tải lại danh mục", exact: true })
        .click();
      await expect(
        p.getByRole("button", { name: "Tải lại danh mục", exact: true }),
      ).toBeEnabled();
      await expect(
        p.getByText(/Tên bộ phận xử lý quá dài.*19 ký tự/),
      ).toBeVisible();
      expect(
        h.requests.filter(
          (r) => r.method === "POST" && r.url === "/api/ticket_manager",
        ).length,
      ).toBe(countBefore);
      const validGroup =
        h.own["handling-departments"]?.name ||
        names.find((name) => Array.from(name.trim()).length <= 19)?.trim();
      if (!validGroup)
        throw new Blocked(
          "No valid handling group is available to verify recovery",
        );
      await h.choose("Bộ phận xử lý", validGroup);
      await expect(p.getByText(/Tên bộ phận xử lý quá dài/)).toHaveCount(0);
      await p.getByRole("button", { name: "Làm lại", exact: true }).click();
    },
  );
}
