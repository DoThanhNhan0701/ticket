import fs from "node:fs";
import path from "node:path";
import { addDays, format } from "date-fns";
import { Harness, expect, Blocked } from "../harness";
import { requireOwn } from "./settings";
import { openAction, confirmAction } from "./ticket-actions";

type Ticket = NonNullable<Harness["ticket"]>;
export interface HrFixtures {
  ticket?: Ticket;
  candidate?: string;
  interview?: string;
  interviewHref?: string;
  day: string;
  attached?: boolean;
  candidateDeletionSubmitted?: boolean;
  candidateDeleted?: boolean;
  interviewDeleted?: boolean;
}
const editor = (h: Harness) =>
  h.page.locator('[role="dialog"][data-editor-action]').last();
export async function closeChooser(h: Harness) {
  const button = h.page.getByRole("button", {
    name: "Đóng chọn thao tác",
    exact: true,
  });
  if (await button.isVisible().catch(() => false)) await button.click();
}
async function save(h: Harness, label = "Lưu") {
  const d = editor(h);
  await d.getByRole("button", { name: label, exact: true }).click();
  await expect(d).toHaveCount(0);
  await closeChooser(h);
}
async function firstChoice(h: Harness, label: string) {
  await editor(h).getByRole("combobox", { name: label, exact: true }).click();
  await h.page
    .getByRole("option")
    .filter({ hasNotText: /^Không chọn$/ })
    .first()
    .click();
}
async function list(h: Harness, label: string, term: string) {
  await h.nav(label);
  await h.page.locator("#recruitment-filter-search").fill(term);
  await h.page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await h.settle();
  return h.page.getByRole("row").filter({ hasText: term });
}
async function rowAction(
  h: Harness,
  label: string,
  term: string,
  action: string,
) {
  const row = await list(h, label, term);
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: /^Thao tác / }).click();
  await h.page
    .getByRole("dialog", { name: "Chọn thao tác", exact: true })
    .getByRole("button", { name: new RegExp(`^${action} `) })
    .click();
  await expect(editor(h)).toBeVisible();
  return editor(h);
}
export function pdfFile(prefix: string, suffix = "CV") {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((text, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${text}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 4\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
    .join("")}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return {
    name: `${prefix}_${suffix}_tiếng-Việt.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(body),
  };
}
async function openHrTicket(h: Harness, f: HrFixtures) {
  if (!f.ticket)
    throw new Blocked("No owned HR request was created through UI");
  await h.nav("Danh sách yêu cầu");
  await h.search(f.ticket.title);
  await h.page.getByRole("link", { name: f.ticket.code, exact: true }).click();
  await expect(
    h.page.getByRole("tab", { name: "Thông tin chung", exact: true }),
  ).toBeVisible();
}
export async function hrJourney(h: Harness) {
  const p = h.page,
    f: HrFixtures = { day: format(addDays(new Date(), 1), "dd/MM/yyyy") };
  const persist = () =>
    fs.writeFileSync(
      path.join(h.root, "hr-fixtures.json"),
      JSON.stringify({ prefix: h.prefix, ...f }, null, 2),
    );
  const candidate = () => {
    if (!f.candidate || f.candidateDeleted)
      throw new Blocked(
        "Owned candidate creation did not complete or candidate was deleted",
      );
    return f.candidate;
  };
  const access = await h.run(
    "recruitment",
    "/recruitment/requests",
    "Verify recruitment sidebar access before creating HR seed data",
    () => h.nav("Yêu cầu tuyển dụng"),
  );
  if (access !== "PASS") {
    for (const route of [
      "/recruitment/requests",
      "/recruitment/candidates",
      "/recruitment/interviews",
      "/recruitment/reports",
    ])
      h.note(
        "recruitment",
        route,
        "Expanded recruitment mutation prerequisites",
        "Recruitment access is unavailable; no HR seed is created for this phase.",
        "BLOCKED",
      );
    return f;
  }
  await createHrRequest(h, f, persist);
  await h.run(
    "recruitment",
    "/requests/:ticketID",
    "Approve own HR request so recruitment list has usable data",
    async () => {
      await openHrTicket(h, f);
      return confirmAction(h, "Phê duyệt", await openAction(h, "Phê duyệt"));
    },
  );
  await h.run(
    "recruitment",
    "/recruitment/requests",
    "Read/update own recruitment request; preserve readonly ticket fields and reopen saved values",
    async () => {
      if (!f.ticket) throw new Blocked("No own HR request");
      let d = await rowAction(
        h,
        "Yêu cầu tuyển dụng",
        f.ticket.title,
        "Xem yêu cầu",
      );
      await expect(d.locator("#recruitment-title")).toBeDisabled();
      await d.locator("#recruitment-quantity").fill("0");
      await d.getByRole("button", { name: "Lưu", exact: true }).click();
      await expect(d.locator("#recruitment-quantity")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await d.locator("#recruitment-quantity").fill("2");
      await d.locator("#recruitment-note").fill(`${h.prefix} HR updated`);
      await d.locator("#recruitment-language_skill").fill("Tiếng Anh TEST");
      await d
        .locator("#recruitment-file_upload")
        .setInputFiles(pdfFile(h.prefix, "HR"));
      await save(h);
      d = await rowAction(
        h,
        "Yêu cầu tuyển dụng",
        f.ticket.title,
        "Xem yêu cầu",
      );
      await expect(d.locator("#recruitment-quantity")).toHaveValue("2");
      await expect(d.locator("#recruitment-note")).toHaveValue(
        `${h.prefix} HR updated`,
      );
      await d.getByRole("button", { name: "Hủy", exact: true }).click();
      await closeChooser(h);
    },
  );
  await h.run(
    "recruitment",
    "/recruitment/requests",
    "Create own candidate: required/phone validation, dependent address, Unicode and CV upload",
    async () => {
      if (!f.ticket) throw new Blocked("No own HR request");
      const d = await rowAction(
        h,
        "Yêu cầu tuyển dụng",
        f.ticket.title,
        "Thêm ứng viên",
      );
      await d.getByRole("button", { name: "Lưu", exact: true }).click();
      await expect(d.locator("#recruitment-first_name")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      const name = `${h.prefix} Ứng viên`;
      await d.locator("#recruitment-first_name").fill(name);
      await d.locator("#recruitment-numberphone").fill("abc");
      await d.getByRole("button", { name: "Lưu", exact: true }).click();
      await expect(d.locator("#recruitment-numberphone")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await d
        .locator("#recruitment-numberphone")
        .fill(`09${String(Date.now()).slice(-8)}`);
      await d
        .locator("#recruitment-email")
        .fill(`${h.prefix.toLowerCase()}@example.invalid`);
      await d.locator("#recruitment-birthday").fill("31/12/1995");
      await firstChoice(h, "Tỉnh/Thành phố");
      await expect(
        d.getByRole("combobox", { name: "Xã/Phường/Đặc khu", exact: true }),
      ).toBeEnabled();
      await firstChoice(h, "Xã/Phường/Đặc khu");
      await d.locator("#recruitment-address").fill(`${h.prefix} Địa chỉ TEST`);
      await d.locator("#recruitment-file_upload").setInputFiles({
        name: "oversize.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
      });
      await expect(
        d.getByText("Tệp không được vượt quá 10 MB.", { exact: true }),
      ).toBeVisible();
      await expect(
        d.getByRole("button", { name: "Lưu", exact: true }),
      ).toBeDisabled();
      await d
        .locator("#recruitment-file_upload")
        .setInputFiles(pdfFile(h.prefix));
      await save(h);
      f.candidate = name;
      persist();
      await expect(await list(h, "Quản lý ứng viên", name)).toHaveCount(1);
    },
  );
  await h.run(
    "recruitment",
    "/recruitment/candidates",
    "Edit own candidate; cancel preserves saved values and history tabs preserve draft",
    async () => {
      const name = candidate();
      let d = await rowAction(h, "Quản lý ứng viên", name, "Sửa hồ sơ");
      await d.locator("#recruitment-education_major").fill(`${h.prefix} CNTT`);
      await d.getByRole("tab", { name: "Lịch sử", exact: true }).click();
      await d.getByRole("tab", { name: "Thông tin", exact: true }).click();
      await expect(d.locator("#recruitment-education_major")).toHaveValue(
        `${h.prefix} CNTT`,
      );
      await save(h);
      d = await rowAction(h, "Quản lý ứng viên", name, "Sửa hồ sơ");
      await expect(d.locator("#recruitment-education_major")).toHaveValue(
        `${h.prefix} CNTT`,
      );
      await d.locator("#recruitment-education_major").fill("UNSAVED");
      await d.getByRole("button", { name: "Hủy", exact: true }).click();
      await closeChooser(h);
      d = await rowAction(h, "Quản lý ứng viên", name, "Sửa hồ sơ");
      await expect(d.locator("#recruitment-education_major")).toHaveValue(
        `${h.prefix} CNTT`,
      );
      await d.getByRole("button", { name: "Hủy", exact: true }).click();
      await closeChooser(h);
    },
  );
  await h.run(
    "recruitment",
    "/recruitment/candidates",
    "Own candidate notes: empty validation, attached note persistence and duplicate lookup",
    async () => {
      const name = candidate();
      let d = await rowAction(h, "Quản lý ứng viên", name, "Ghi chú");
      await d
        .getByRole("button", { name: "Thêm ghi chú", exact: true })
        .click();
      await expect(
        d.getByText("Vui lòng nhập ghi chú hoặc đính kèm tệp.", {
          exact: true,
        }),
      ).toBeVisible();
      await d
        .locator("#recruitment-note")
        .fill(`${h.prefix} Ghi chú phỏng vấn`);
      await d
        .locator('input[type="file"]')
        .setInputFiles(pdfFile(h.prefix, "note"));
      await d
        .getByRole("button", { name: "Thêm ghi chú", exact: true })
        .click();
      await expect(
        d.getByText(`${h.prefix} Ghi chú phỏng vấn`, { exact: true }),
      ).toBeVisible();
      await d.getByRole("button", { name: "Hủy", exact: true }).click();
      await closeChooser(h);
      d = await rowAction(h, "Quản lý ứng viên", name, "Kiểm tra trùng");
      await expect(
        d.getByText(/Không tìm thấy hồ sơ trùng lặp\.|Mã CV/).first(),
      ).toBeVisible();
      await p.keyboard.press("Escape");
      await closeChooser(h);
    },
  );
  await h.run(
    "recruitment",
    "/recruitment/candidates",
    "Change own candidate status with validation and visible refreshed badge",
    async () => {
      const name = candidate();
      const d = await rowAction(
        h,
        "Quản lý ứng viên",
        name,
        "Chuyển trạng thái",
      );
      await d.getByRole("button", { name: "Lưu", exact: true }).click();
      await expect(d.locator("#recruitment-cv_status")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await firstChoice(h, "Trạng thái");
      const status = await d.locator("#recruitment-cv_status").innerText();
      await d
        .locator("#recruitment-why_change")
        .fill(`${h.prefix} Test status`);
      await save(h);
      await expect(
        (await list(h, "Quản lý ứng viên", name)).getByText(status, {
          exact: true,
        }),
      ).toBeVisible();
    },
  );
  await createInterview(h, f, persist);
  await h.run(
    "recruitment",
    "/recruitment/candidates",
    "Bulk selection attaches only own candidate to own interview",
    async () => {
      const name = candidate();
      if (!f.interview) throw new Blocked("Owned interview is unavailable");
      const row = await list(h, "Quản lý ứng viên", name);
      await row.getByRole("checkbox").click();
      await p.getByRole("button", { name: /^Gắn lịch/ }).click();
      const d = editor(h);
      await d.locator("#recruitment-start_date").fill(f.day);
      await d
        .getByRole("combobox", { name: "Lịch phỏng vấn", exact: true })
        .click();
      await p.getByRole("option").filter({ hasText: f.interview }).click();
      await save(h);
      f.attached = true;
      persist();
    },
  );
  await h.run(
    "recruitment",
    "/recruitment/interviews/:codeInterview",
    "Calendar → interview detail; own candidate time validation, profile, note and removal",
    async () => {
      const name = candidate();
      if (!f.interview || !f.attached)
        throw new Blocked(
          "Own candidate attach prerequisite did not complete; inspect the attach scenario",
        );
      await h.nav("Lịch phỏng vấn");
      await p
        .getByRole("button", {
          name: `Xem CV lịch ${f.interview}`,
          exact: true,
        })
        .click();
      await expect(p).toHaveURL(/\/recruitment\/interviews\/[^/?]+/);
      h.visits.add("/recruitment/interviews/:codeInterview");
      f.interviewHref = new URL(p.url()).pathname;
      persist();
      const row = p.getByRole("row").filter({ hasText: name });
      await expect(row).toHaveCount(1);
      const action = async (label: string) => {
        await row.getByRole("button", { name: /^Thao tác / }).click();
        await p
          .getByRole("dialog", { name: "Chọn thao tác", exact: true })
          .getByRole("button", { name: new RegExp(`^${label} `) })
          .click();
        return editor(h);
      };
      let d = await action("Đặt giờ");
      await d.locator("#recruitment-time_start").fill("08:30");
      await d.getByRole("button", { name: "Lưu", exact: true }).click();
      await expect(d.locator("#recruitment-time_start")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await d.locator("#recruitment-time_start").fill("09:15");
      await save(h);
      await expect(row.getByText("09:15", { exact: true })).toBeVisible();
      d = await action("Xem hồ sơ");
      await expect(d.getByText(name, { exact: true }).first()).toBeVisible();
      await p.keyboard.press("Escape");
      await closeChooser(h);
      d = await action("Bỏ khỏi lịch");
      await d
        .getByRole("button", { name: "Bỏ khỏi lịch phỏng vấn", exact: true })
        .click();
      await expect(d).toHaveCount(0);
      await closeChooser(h);
      await expect(row).toHaveCount(0);
    },
  );
  for (const [label, route] of [
    ["Yêu cầu tuyển dụng", "/recruitment/requests"],
    ["Quản lý ứng viên", "/recruitment/candidates"],
    ["Báo cáo tuyển dụng", "/recruitment/reports"],
  ])
    await h.run(
      "recruitment",
      route,
      `Export ${label} through visible UI`,
      async () => {
        await h.nav(label);
        const download = p.waitForEvent("download");
        await p
          .getByRole("button", { name: "Xuất Excel", exact: true })
          .click();
        const file = await download;
        expect(
          fs
            .readFileSync(await file.path())
            .subarray(0, 2)
            .toString(),
        ).toBe("PK");
      },
    );
  await h.run(
    "recruitment",
    "/recruitment/candidates",
    "Delete only own CV file; keep candidate record",
    async () => {
      const name = candidate();
      let d = await rowAction(h, "Quản lý ứng viên", name, "Xóa tệp CV");
      await save(h, "Xóa tệp CV");
      d = await rowAction(h, "Quản lý ứng viên", name, "Sửa hồ sơ");
      await expect(
        d.getByRole("region", { name: "Tệp CV", exact: true }),
      ).toHaveCount(0);
      await d.getByRole("button", { name: "Hủy", exact: true }).click();
      await closeChooser(h);
    },
  );
  await h.run(
    "recruitment",
    "/recruitment/candidates",
    "Delete only own disposable candidate and verify no results",
    async () => {
      const name = candidate();
      await rowAction(h, "Quản lý ứng viên", name, "Xóa hồ sơ");
      await save(h, "Xóa hồ sơ ứng viên");
      f.candidateDeletionSubmitted = true;
      persist();
      await expect(await list(h, "Quản lý ứng viên", name)).toHaveCount(0);
      f.candidateDeleted = true;
      persist();
    },
  );
  await h.run(
    "recruitment",
    "/recruitment/interviews",
    "Delete only own disposable interview and verify calendar card removal",
    async () => {
      if (!f.interview) throw new Blocked("No owned interview");
      await h.nav("Lịch phỏng vấn");
      await p
        .getByRole("button", { name: `Xóa lịch ${f.interview}`, exact: true })
        .click();
      await save(h);
      f.interviewDeleted = true;
      persist();
      await expect(
        p.getByRole("article", { name: f.interview, exact: true }),
      ).toHaveCount(0);
    },
  );
  await h.run(
    "ticket-actions",
    "/requests/:ticketID",
    "Cancel own HR request: reason validation and cancellation attachment",
    async () => {
      await openHrTicket(h, f);
      const d = await openAction(h, "Hủy");
      await d.getByRole("button", { name: "Hủy", exact: true }).click();
      await expect(d.locator('[aria-invalid="true"]').first()).toBeVisible();
      await d.getByRole("textbox").fill(`${h.prefix} HR E2E cleanup`);
      await d
        .locator('input[type="file"]')
        .setInputFiles(pdfFile(h.prefix, "cancel"));
      return confirmAction(h, "Hủy", d);
    },
  );
  await cleanupHrSeed(h, f);
  await hrCancelJourney(h);
  persist();
  return f;
}

export async function createHrRequest(
  h: Harness,
  f: HrFixtures,
  persist: () => void,
  suffix = "HR Tuyển dụng",
) {
  const p = h.page;
  await h.run(
    "recruitment",
    "/requests/new",
    "Create real recruitment data via Create Request → HR → Yêu cầu tuyển dụng",
    async () => {
      await h.nav("Danh sách yêu cầu");
      await p.getByRole("link", { name: "Tạo yêu cầu", exact: true }).click();
      await h.choose("Bộ phận xử lý", "HR");
      await h.choose("Loại yêu cầu", "Yêu cầu tuyển dụng");
      await h.choose(
        "Người phê duyệt",
        h.primaryName || requireOwn(h, "users").name,
      );
      const company = p.getByRole("combobox", { name: "Công ty", exact: true });
      if ((await company.innerText()).includes("Chọn")) {
        await company.click();
        await p.getByRole("option").first().click();
      }
      const title = `${h.prefix} ${suffix}`;
      await p.locator("#create-title").fill(title);
      for (const [label, kind] of [
        ["Department", "requesting-departments"],
        ["Văn phòng", "offices"],
      ]) {
        if (h.own[kind]) await h.choose(label, h.own[kind].name);
        else {
          await p.getByRole("combobox", { name: label, exact: true }).click();
          await p.getByRole("option").first().click();
        }
      }
      const values = [
        h.own["teams"]?.name || `${h.prefix} Team`,
        `${h.prefix} QA`,
        "1",
        f.day,
        "TEST từ xa",
        "10000000",
      ];
      for (let i = 0; i < values.length; i++)
        await p.locator(`#detail-0-f${i}`).fill(values[i]);
      for (const index of [6, 7, 9]) {
        await p.locator(`#detail-0-f${index}`).click();
        await p.getByRole("option").first().click();
      }
      for (const [index, value] of [
        [8, `${h.prefix} Kiểm thử tuyển dụng`],
        [10, "25-35"],
        [11, "3 năm"],
        [12, "Tiếng Việt"],
      ] as const)
        await p.locator(`#detail-0-f${index}`).fill(value);
      await p
        .locator("#create-description")
        .fill(`${h.prefix} Disposable HR workflow`);
      await p.getByRole("button", { name: "Tạo yêu cầu", exact: true }).click();
      await expect(p).toHaveURL(/\/requests(?:\?|$)/);
      await h.search(title);
      const row = p.getByRole("row").filter({ hasText: title });
      const code = row.getByRole("link").first();
      f.ticket = {
        title,
        code: await code.innerText(),
        href: (await code.getAttribute("href"))!,
      };
      persist();
      await code.click();
    },
  );
}
export async function hrCancelJourney(h: Harness) {
  const f: HrFixtures = { day: format(addDays(new Date(), 1), "dd/MM/yyyy") };
  const persist = () =>
    fs.writeFileSync(
      path.join(h.root, "hr-cancel-fixtures.json"),
      JSON.stringify({ prefix: h.prefix, ...f }, null, 2),
    );
  await createHrRequest(h, f, persist, "HR Hủy TEST");
  await h.run(
    "ticket-actions",
    "/requests/:ticketID",
    "Cancel fresh own HR ticket before approval: required reason and attachment",
    async () => {
      await openHrTicket(h, f);
      const d = await openAction(h, "Hủy");
      await d.getByRole("button", { name: "Hủy", exact: true }).click();
      await expect(d.locator('[aria-invalid="true"]').first()).toBeVisible();
      const reason = `${h.prefix} Cancel regression finished`;
      await d.getByRole("textbox").fill(reason);
      await d
        .locator('input[type="file"]')
        .setInputFiles(pdfFile(h.prefix, "cancel"));
      await confirmAction(h, "Hủy", d);
      await openHrTicket(h, f);
      await expect(h.page.getByText(reason, { exact: true })).toBeVisible();
    },
  );
  persist();
}

export async function createInterview(
  h: Harness,
  f: HrFixtures,
  persist: () => void,
) {
  const p = h.page;
  await h.run(
    "recruitment",
    "/recruitment/interviews",
    "Create and update own interview: required fields, invalid time range, saved date/time",
    async () => {
      await h.nav("Lịch phỏng vấn");
      await p
        .getByRole("button", { name: "Tạo lịch phỏng vấn", exact: true })
        .click();
      let d = editor(h);
      await d.getByRole("button", { name: "Lưu", exact: true }).click();
      await expect(d.locator("#recruitment-title")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      const name = `${h.prefix} Phỏng vấn`;
      await d.locator("#recruitment-title").fill(name);
      await d.locator("#recruitment-start_date").fill(f.day);
      await d.locator("#recruitment-time_start").fill("09:00");
      await d.locator("#recruitment-time_end").fill("08:00");
      await d.getByRole("button", { name: "Lưu", exact: true }).click();
      await expect(
        d.getByText("Giờ kết thúc phải sau giờ bắt đầu.", { exact: true }),
      ).toBeVisible();
      await d.locator("#recruitment-time_end").fill("10:00");
      await save(h);
      f.interview = name;
      persist();
      await p
        .getByRole("button", { name: `Sửa lịch ${name}`, exact: true })
        .click();
      d = editor(h);
      await expect(d.locator("#recruitment-time_start")).toHaveValue("09:00");
      await d
        .locator("#recruitment-note")
        .fill(`${h.prefix} Interview updated`);
      await save(h);
      await expect(p.getByRole("article", { name, exact: true })).toBeVisible();
      await p
        .getByRole("button", { name: `Sửa lịch ${name}`, exact: true })
        .click();
      await expect(editor(h).locator("#recruitment-note")).toHaveValue(
        `${h.prefix} Interview updated`,
      );
      await editor(h).getByRole("button", { name: "Hủy", exact: true }).click();
    },
  );
}
export async function interviewRegression(h: Harness) {
  const f: HrFixtures = { day: format(addDays(new Date(), 1), "dd/MM/yyyy") };
  const persist = () =>
    fs.writeFileSync(
      path.join(h.root, "interview-fixtures.json"),
      JSON.stringify({ prefix: h.prefix, ...f }, null, 2),
    );
  await createInterview(h, f, persist);
  await h.run(
    "recruitment",
    "/recruitment/interviews",
    "Delete own interview regression fixture through UI",
    async () => {
      if (!f.interview) throw new Blocked("No own interview was created");
      await h.nav("Lịch phỏng vấn");
      await h.page
        .getByRole("button", { name: `Xóa lịch ${f.interview}`, exact: true })
        .click();
      await save(h);
      await expect(
        h.page.getByRole("article", { name: f.interview, exact: true }),
      ).toHaveCount(0);
      f.interviewDeleted = true;
      persist();
    },
  );
}

export async function cleanupHrSeed(h: Harness, f: HrFixtures) {
  return h.run(
    "recruitment",
    "/requests/change-status",
    "Cancel owned approved HR seed through permitted Change Status UI",
    async () => {
      if (!f.ticket) throw new Blocked("No owned HR seed exists");
      expect(f.ticket.title).toMatch(/^TESTFE_[A-Z0-9]{6} HR Tuyển dụng$/);
      expect(f.ticket.code).toMatch(/^HR_\d{6}_\d+$/);
      await openHrTicket(h, f);
      await expect(
        h.page.getByText(f.ticket.title, { exact: true }),
      ).toBeVisible();
      const status = h.page.getByRole("group", {
        name: "Trạng thái yêu cầu",
        exact: true,
      });
      if ((await status.innerText()).trim() === "Hủy")
        return { alreadyCancelled: true };
      await h.nav("Chuyển trạng thái yêu cầu");
      await h.page.locator("#change-status-code").fill(f.ticket.code);
      await h.choose("Trạng thái", "Hủy");
      const reason = `${f.ticket.title.split(" ")[0]} Approved HR seed cleanup`;
      await h.page.locator("#change-status-reason").fill(reason);
      await h.page
        .getByRole("button", { name: "Cập nhật", exact: true })
        .click();
      await expect(
        h.page.locator('[data-sonner-toast][data-type="success"]').first(),
      ).toBeVisible();
      await openHrTicket(h, f);
      await expect(
        h.page.getByRole("group", { name: "Trạng thái yêu cầu", exact: true }),
      ).toHaveText("Hủy");
    },
  );
}
export async function retainedHrCleanup(h: Harness) {
  const files = JSON.parse(
    process.env.E2E_HR_CLEANUP_FIXTURES || "[]",
  ) as string[];
  const results = [];
  for (const file of files) {
    const fixture = JSON.parse(fs.readFileSync(file, "utf8")) as HrFixtures;
    results.push({
      file,
      ticket: fixture.ticket,
      status: await cleanupHrSeed(h, fixture),
    });
  }
  fs.writeFileSync(
    path.join(h.root, "hr-admin-cleanup.json"),
    JSON.stringify(results, null, 2),
  );
}
