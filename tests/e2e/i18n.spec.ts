import { expect, test, type Page } from "@playwright/test";
import {
  settingsFixtures,
  settingsPermissionFixture,
} from "../fixtures/settings";
import {
  requestTicketFixture,
  requestStatusFixtures,
} from "../fixtures/requests";
import { requestDetailFixture } from "../fixtures/request-detail";

async function mockApi(page: Page) {
  const account = {
    ...settingsPermissionFixture,
    userPermission: [
      "can_view",
      "can_create",
      "can_allticket",
      "can_return_ticket",
      "can_accept",
      "can_process",
      "can_report",
      "can_export",
      "can_hr_rec",
      "can_cv_interview",
      "can_system",
    ],
    is_admin: true,
    is_handling: true,
    can_assign: true,
  };
  await page.route("**/api/**", async (route) => {
    // Vite's source modules also contain /api/ in their paths.
    if (!new URL(route.request().url()).pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }
    const path = new URL(route.request().url()).pathname.replace(
      /^.*\/api/,
      "",
    );
    const paged = (rows: unknown[]) => ({
      count: rows.length,
      next: null,
      previous: null,
      results: rows,
    });
    let body: unknown = [];
    if (path === "/token/")
      body = { access: "i18n-mock-access", refresh: "i18n-mock-refresh" };
    else if (path === "/list_permission/") body = account;
    else if (path === "/list_ticketstatus/") body = requestStatusFixtures;
    else if (path === "/list_customer/")
      body = [{ id: 2, name: "Rainscales VN", is_active: true }];
    else if (path === "/list_useraccept/" || path === "/list_user_v2/")
      body = [settingsFixtures.users];
    else if (path === "/list_handling_group/")
      body = paged([settingsFixtures["handling-departments"]]);
    else if (path === "/list_bophan_sudung/")
      body = paged([settingsFixtures["requesting-departments"]]);
    else if (path === "/list_tickettype/")
      body = paged([settingsFixtures["request-types"]]);
    else if (path === "/list_team/") body = [settingsFixtures.teams];
    else if (path === "/list_vanphong/") body = [settingsFixtures.offices];
    else if (path === "/list_chucvu/") body = [settingsFixtures.positions];
    else if (path.startsWith("/template_form/")) body = { forms: [] };
    else if (path === "/ticket_manager/42")
      body = {
        ...requestDetailFixture,
        list_button: { "Phê duyệt": "approve" },
      };
    else if (/^\/list_ticket(?:_all_SupAD|_personal|_all)?\/$/.test(path))
      body = paged([requestTicketFixture]);
    else if (path.includes("list_cv") || path.includes("recruitment_system"))
      body = paged([]);
    else if (path.includes("input")) body = {};
    await route.fulfill({ json: body });
  });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/^Tên đăng nhập/).fill("i18n.test");
  await page
    .getByLabel(/^Mật khẩu/, { exact: false })
    .first()
    .fill("mock-only-password");
  await page.getByRole("button", { name: "Đăng nhập vào Ticket" }).click();
  await expect(
    page.getByRole("button", { name: "Đăng xuất", exact: true }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => mockApi(page));

test("defaults to Vietnamese, switches validation, retains input, persists across reload and tabs", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await page.getByRole("button", { name: "Đăng nhập vào Ticket" }).click();
  await expect(
    page.getByText("Vui lòng nhập tên đăng nhập.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel(/^Tên đăng nhập/).fill("bản nháp");
  await page.getByRole("combobox", { name: "Ngôn ngữ" }).click();
  await page.getByRole("option", { name: "English" }).click();
  await expect(page.getByLabel(/^Username/)).toHaveValue("bản nháp");
  await expect(
    page.getByText("Password is required.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const tab = await context.newPage();
  await tab.goto("/login");
  await tab.getByRole("combobox", { name: "Language" }).click();
  await tab.getByRole("option", { name: "Tiếng Việt" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await tab.close();
});

test("switches all page headings and navigation, without translating stored request content", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("combobox", { name: "Ngôn ngữ" }).click();
  await page.getByRole("option", { name: "English" }).click();
  const pages = [
    ["/requests", "Request list"],
    ["/requests/all", "All requests"],
    ["/approvals/pending", "Pending approval"],
    ["/approvals/approved", "Approved"],
    ["/tasks/mine", "Assigned to me"],
    ["/tasks", "All tasks"],
    ["/requests/change-status", "Change request status"],
    ["/reports", "Reports"],
    ["/reports/export", "Data export"],
    ["/recruitment/requests", "Recruitment requests"],
    ["/recruitment/candidates", "Candidates"],
    ["/recruitment/interviews", "Interview calendar"],
    ["/recruitment/reports", "Recruitment reports"],
    ["/settings/users", "Users"],
    ["/settings/requesting-departments", "Requesting departments"],
    ["/settings/handling-departments", "Processing departments"],
    ["/settings/request-types", "Request types"],
    ["/settings/teams", "Team"],
    ["/settings/positions", "Positions"],
    ["/settings/offices", "Offices"],
  ];
  for (const [url, title] of pages) {
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: title, exact: true }).first(),
      url,
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
  }
  await page.goto("/requests/42");
  await expect(
    page.getByText(requestTicketFixture.title, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Approve request");
  await page.getByRole("button", { name: "Close request actions" }).click();
  await page.goto("/help");
  await expect(
    page.getByRole("heading", { name: "1. Getting started", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download Word document" }),
  ).toHaveAttribute("href", /User-Guide\.docx$/);
  await page.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: "Tiếng Việt" }).click();
  await expect(
    page.getByRole("heading", { name: "1. Bắt đầu sử dụng", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("keeps a request draft and options intact while switching and fits mobile headers", async ({
  page,
}) => {
  await login(page);
  await page.goto("/requests/new");
  await page
    .getByRole("combobox", { name: "Bộ phận xử lý", exact: true })
    .click();
  await page.getByRole("option", { name: "ISMS", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Loại yêu cầu", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Đăng ký từ xa", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Người phê duyệt", exact: true })
    .click();
  await page.getByRole("option", { name: "Đỗ Nhân", exact: true }).click();
  const title = page.getByRole("textbox", {
    name: "Tiêu đề yêu cầu",
    exact: true,
  });
  await title.fill("Nội dung người dùng: Hủy");
  await page.getByRole("combobox", { name: "Ngôn ngữ" }).click();
  await page.getByRole("option", { name: "English" }).click();
  await expect(
    page.getByRole("textbox", { name: "Request title", exact: true }),
  ).toHaveValue("Nội dung người dùng: Hủy");
  await expect(
    page.getByRole("combobox", { name: "Request type", exact: true }),
  ).toContainText("Đăng ký từ xa");
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await page
      .getByRole("banner")
      .evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflow, `header at ${width}px`).toBe(false);
    await expect(
      page.getByRole("combobox", { name: "Language" }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: "test-results/i18n/mobile-english.png",
    fullPage: true,
  });
});
