// @vitest-environment jsdom
import { expectErrorToast } from "./fixtures/assert-error-toast";
import { readFileSync } from "node:fs";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  convertGuideDocument,
  loadUserGuide,
  USER_GUIDE_URL,
  type GuideDocument,
} from "@/features/help/api/user-guide-api";
import App from "@/app/app";
import { PendingAttachmentsProvider } from "@/features/requests/providers/pending-attachments-provider";
let router: ReturnType<typeof createMemoryRouter> | undefined;
import { requestDetailFixture } from "./fixtures/request-detail";
import { requestDetailSchema } from "@/features/requests/schemas/request-detail-schema";
import { getRequestDetail } from "@/features/requests/api/request-detail-api";
import {
  canAccessPage,
  getDefaultWorkspacePath,
  isPageActive,
  navigationGroups,
  workspacePages,
} from "@/app/navigation";

vi.mock("@/features/requests/api/request-detail-api", () => ({
  validTicketId: (id: string) => /^[1-9]\d*$/.test(id),
  getRequestDetail: vi.fn(() =>
    Promise.resolve(requestDetailSchema.parse(requestDetailFixture)),
  ),
  getTicketHistory: vi.fn().mockResolvedValue([]),
  addTicketComment: vi.fn(),
  updateTicketSection: vi.fn(),
}));
import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/context/auth-context";

vi.mock("@/features/requests/api/requests-api", () => ({
  listRequestsRequest: vi.fn().mockResolvedValue({ count: 0, results: [] }),
  listRequestStatusesRequest: vi.fn().mockResolvedValue([]),
  listAllRequestsRequest: vi.fn().mockResolvedValue({ count: 0, results: [] }),
  listRequestTypesRequest: vi.fn().mockResolvedValue([]),
  listRequestTeamsRequest: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/reports/api/reports-api", () => ({
  listReportGroupsRequest: vi.fn().mockResolvedValue([]),
  listReportTypesRequest: vi.fn().mockResolvedValue([]),
  getReportRequest: vi.fn(),
  exportReportRequest: vi.fn(),
  exportReportDataRequest: vi.fn(),
}));

vi.mock("@/features/settings/api/settings-api", () => ({
  listSettingsRequest: vi.fn().mockResolvedValue({ count: 0, results: [] }),
  settingsLookupsRequest: vi.fn().mockResolvedValue({}),
  settingsDetailRequest: vi.fn(),
  saveSettingsRequest: vi.fn(),
}));

vi.mock("@/features/requests/api/create-request-api", () => ({
  getCreateRequestLookups: vi.fn().mockResolvedValue({
    groups: [],
    departments: [],
    teams: [],
    offices: [],
    approvers: [],
    customers: [],
  }),
  getCreateRequestTypes: vi.fn().mockResolvedValue([]),
  createRequest: vi.fn(),
  uploadRequestAttachment: vi.fn(),
  exportRequestTemplate: vi.fn(),
  importRequestTemplate: vi.fn(),
}));

vi.mock("@/features/recruitment/api/recruitment-api", () => ({
  listRecruitment: vi.fn().mockResolvedValue({ count: 0, results: [] }),
  recruitmentLookups: vi.fn().mockResolvedValue({}),
  recruitmentArray: vi.fn().mockResolvedValue([]),
  recruitmentObject: vi.fn().mockResolvedValue({}),
  interviewDetail: vi.fn().mockResolvedValue([]),
  recruitmentDetail: vi.fn(),
  recruitmentWrite: vi.fn(),
  recruitmentMultipart: vi.fn(),
  exportRecruitment: vi.fn(),
}));

vi.mock("@/features/help/api/user-guide-api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/help/api/user-guide-api")>();
  return { ...actual, loadUserGuide: vi.fn() };
});

let client: QueryClient;
let auth: AuthContextValue;
let guideDocument: GuideDocument;

beforeAll(async () => {
  const buffer = Uint8Array.from(
    readFileSync(new URL("../public" + USER_GUIDE_URL, import.meta.url)),
  ).buffer;
  guideDocument = await convertGuideDocument(buffer);
});

beforeEach(() => {
  vi.mocked(loadUserGuide).mockResolvedValue(guideDocument);
  localStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  auth = {
    token: "ticket-session",
    username: "ticket-user",
    userId: 1,
    avatarUrl: null,
    permissions: { can_create: true, can_view: true },
    userPermission: null,
    isInitializing: false,
    isLoading: false,
    error: null,
    login: vi.fn().mockResolvedValue(true),
    logout: vi.fn(),
    setError: vi.fn(),
    refreshUserPermission: vi.fn().mockResolvedValue(null),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  router?.dispose();
  router = undefined;
  client.clear();
});

function CurrentPath() {
  const { pathname, search, hash } = useLocation();
  return (
    <output data-testid="current-path">
      {pathname}
      {search}
      {hash}
    </output>
  );
}

function appElement(path = "/") {
  router ??= createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <PendingAttachmentsProvider>
            <App />
            <CurrentPath />
          </PendingAttachmentsProvider>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

function renderApp(path = "/") {
  return render(appElement(path));
}

it("preserves unsent files and reply text across all detail tabs, warning only when leaving the ticket", async () => {
  renderApp("/requests/42?tab=general");
  await screen.findByRole("tab", { name: "Thông tin chung" });
  const general = screen.getByRole("tabpanel", { name: "Thông tin chung" });
  fireEvent.change(within(general).getByLabelText("Tệp đính kèm"), {
    target: { files: [new File(["draft"], "general-draft.txt")] },
  });
  fireEvent.click(screen.getByRole("tab", { name: /Trao đổi/ }));
  const discussion = await screen.findByRole("tabpanel", { name: /Trao đổi/ });
  const reply = within(discussion).getByRole("form", { name: "Phản hồi mới" });
  fireEvent.change(within(reply).getByLabelText("Phản hồi"), {
    target: { value: "Phản hồi chưa gửi" },
  });
  fireEvent.change(within(reply).getByLabelText("Tệp đính kèm"), {
    target: { files: [new File(["reply"], "reply-draft.txt")] },
  });

  for (const name of [
    "Chi tiết yêu cầu",
    "Lịch sử",
    "Thông tin chung",
    "Trao đổi",
    "Thông tin chung",
  ]) {
    fireEvent.click(screen.getByRole("tab", { name: new RegExp(`^${name}`) }));
    await screen.findByRole("tabpanel", { name: new RegExp(`^${name}`) });
    expect(screen.queryByRole("dialog")).toBeNull();
  }
  expect(
    within(general).getByRole("button", { name: "Bỏ tệp general-draft.txt" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: /Trao đổi/ }));
  expect(
    (within(reply).getByLabelText("Phản hồi") as HTMLTextAreaElement).value,
  ).toBe("Phản hồi chưa gửi");
  expect(
    within(reply).getByRole("button", { name: "Bỏ tệp reply-draft.txt" }),
  ).toBeTruthy();

  fireEvent.click(screen.getByRole("link", { name: "Danh sách yêu cầu" }));
  await screen.findByRole("dialog", { name: "Tệp đính kèm chưa được gửi" });
  expect(screen.getByText(/Bạn còn 2 tệp đính kèm/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Ở lại" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByTestId("current-path").textContent).toBe(
    "/requests/42?tab=discussion",
  );

  fireEvent.click(screen.getByRole("link", { name: "Danh sách yêu cầu" }));
  fireEvent.click(await screen.findByRole("button", { name: "Rời trang" }));
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("opens the guide from the header and lets signed-in users read chapters without feature permissions", async () => {
  auth.permissions = {};
  renderApp("/help?chapter=2");
  const help = await screen.findByRole("button", {
    name: "Hướng dẫn sử dụng",
  });
  expect(help.closest("header")).toBeTruthy();
  fireEvent.click(help);
  await screen.findByRole("heading", { name: "1. Bắt đầu sử dụng" });
  expect(screen.getByTestId("current-path").textContent).toBe("/help");
  fireEvent.click(
    screen.getByRole("button", { name: "4. Tạo một yêu cầu mới" }),
  );
  await screen.findByRole("heading", { name: "4. Tạo một yêu cầu mới" });
  expect(screen.getByTestId("current-path").textContent).toBe(
    "/help?chapter=4",
  );
  expect(
    screen.getByRole("heading", { name: "4.7. Gửi và kiểm tra kết quả" }),
  ).toBeTruthy();
  const download = screen.getByRole("link", { name: "Tải tài liệu Word" });
  expect(download.getAttribute("href")).toBe(
    "/docs/Rainscales-Ticket-Huong-dan-su-dung-toan-bo-website.docx",
  );
  expect(download.hasAttribute("download")).toBe(true);
});

it("falls back to the first guide chapter for an invalid chapter link", async () => {
  renderApp("/help?chapter=999");
  await screen.findByRole("heading", { name: "1. Bắt đầu sử dụng" });
});

it("offers Word download and retries when reading the guide fails", async () => {
  vi.mocked(loadUserGuide).mockRejectedValueOnce(new Error("Network failed"));
  renderApp("/help");
  await expectErrorToast("Không đọc được tài liệu hướng dẫn.");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Tải tài liệu Word" })
      .getAttribute("href"),
  ).toBe(USER_GUIDE_URL);
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  await screen.findByRole("heading", { name: "1. Bắt đầu sử dụng" });
});

it("opens a chapter through the table of contents inside the original Word document", async () => {
  renderApp("/help");
  await screen.findByRole("heading", { name: "1. Bắt đầu sử dụng" });
  fireEvent.click(screen.getByText("Thông tin tài liệu"));
  fireEvent.click(
    screen.getByRole("link", { name: /^4\. Tạo một yêu cầu mới/ }),
  );
  await screen.findByRole("heading", { name: "4. Tạo một yêu cầu mới" });
  expect(screen.getByTestId("current-path").textContent).toBe(
    "/help?chapter=4",
  );
});

it("moves between guide chapters and disables navigation at the boundaries", async () => {
  renderApp("/help");
  await screen.findByRole("heading", { name: "1. Bắt đầu sử dụng" });
  expect(
    (screen.getByRole("button", { name: "Chương trước" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Chương tiếp theo" }));
  expect(screen.getByTestId("current-path").textContent).toBe(
    "/help?chapter=2",
  );
  expect(
    screen
      .getByRole("button", { name: "Chương trước" })
      .hasAttribute("disabled"),
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Chương trước" }));
  await screen.findByRole("heading", { name: "1. Bắt đầu sử dụng" });
  fireEvent.click(
    screen.getByRole("button", { name: "15. Khi gặp vấn đề và cần hỗ trợ" }),
  );
  expect(
    screen
      .getByRole("button", { name: "Chương tiếp theo" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

it("requires sign-in before opening the user guide", async () => {
  auth.token = null;
  renderApp("/help");
  await screen.findByRole("button", { name: "Sign In to Ticket" });
  expect(screen.getByTestId("current-path").textContent).toBe("/login");
});

it("redirects the root to the request list with no overview navigation", async () => {
  renderApp();
  expect(
    await screen.findByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeTruthy();
  expect(screen.queryByRole("link", { name: "User Management" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Change Password" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Tổng quan" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Ticket" })).toBeNull();
  expect(screen.getByTestId("current-path").textContent).toBe("/requests");
  expect(
    screen
      .getByRole("link", { name: "Rainscales Ticket home" })
      .getAttribute("href"),
  ).toBe("/requests");
  expect(screen.getByRole("button", { name: "Sign Out" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: /Switch to .* theme/ }),
  ).toBeTruthy();
  const createLink = within(screen.getByRole("main")).getByRole("link", {
    name: "Tạo yêu cầu",
  });
  expect(createLink.getAttribute("href")).toBe("/requests/new");
  expect(
    createLink
      .closest("header")
      ?.contains(screen.getByRole("heading", { name: "Danh sách yêu cầu" })),
  ).toBe(true);
  fireEvent.click(createLink);
  expect(
    await screen.findByRole("heading", { name: "Tạo yêu cầu" }),
  ).toBeTruthy();
  expect(screen.getByTestId("current-path").textContent).toBe("/requests/new");
});

it.each(["/", "/login", "/unknown-page"])(
  "opens the first permitted page from %s for the reported task/report account",
  async (path) => {
    auth.permissions = {
      can_process: true,
      can_report: true,
      can_export: true,
    };
    renderApp(path);
    await screen.findByRole("heading", { name: "Nhiệm vụ cá nhân" });
    expect(screen.getByTestId("current-path").textContent).toBe("/tasks/mine");
    expect(
      screen
        .getByRole("link", { name: "Rainscales Ticket home" })
        .getAttribute("href"),
    ).toBe("/tasks/mine");
    expect(screen.queryByText("Bạn chưa có quyền truy cập")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Danh sách yêu cầu" }),
    ).toBeNull();
  },
);

it.each([
  [{}, "/requests"],
  [{ is_superuser: true }, "/requests"],
  [{ can_view: true, can_process: true }, "/requests"],
  [{ can_create: true }, "/requests/new"],
  [{ can_allticket: true }, "/requests/all"],
  [{ can_accept: true }, "/approvals/pending"],
  [{ can_report: true }, "/reports"],
  [{ can_export: true }, "/reports/export"],
  [{ can_system: true }, "/settings/users"],
])("selects a home path for functional permissions %j", (permissions, path) => {
  expect(getDefaultWorkspacePath(permissions)).toBe(path);
});

it.each([
  "/",
  "/change-password",
  "/reports",
  "/settings/users",
  "/tickets/42",
  "/chopheduyet",
])("protects %s when signed out", async (path) => {
  auth.token = null;
  renderApp(path);
  expect(
    await screen.findByRole("button", { name: "Sign In to Ticket" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeNull();
});

it.each([
  [
    "/danhsachyeucau?status=open#filters",
    "/requests?status=open#filters",
    "Danh sách yêu cầu",
  ],
  ["/chopheduyet?team=1", "/approvals/pending?team=1", "Chờ phê duyệt"],
  [
    "/dapheduyet?page=2#results",
    "/approvals/approved?page=2#results",
    "Đã phê duyệt",
  ],
  ["/danhsachxulycanhan", "/tasks/mine", "Nhiệm vụ cá nhân"],
  [
    "/export_data?group=3#filters",
    "/reports/export?group=3#filters",
    "Truy xuất dữ liệu",
  ],
  ["/danhsachxuly?page=2#results", "/tasks?page=2#results", "Tất cả nhiệm vụ"],
  [
    "/settings/vanphong?search=Da%20Nang",
    "/settings/offices?search=Da%20Nang",
    "Văn phòng",
  ],
])(
  "redirects old URL %s to %s with its query and fragment intact",
  async (oldUrl, newUrl, title) => {
    auth.permissions = Object.fromEntries(
      workspacePages.map((page) => [page.permission, true]),
    );
    renderApp(oldUrl);
    expect(await screen.findByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByTestId("current-path").textContent).toBe(newUrl);
  },
);

it("preserves encoded record identifiers when redirecting an email ticket URL", async () => {
  renderApp(
    "/tickets-from-mail/view/TICKET%2042%2FA?source=email#conversation",
  );
  expect(
    await screen.findByRole("heading", { name: "Yêu cầu từ email" }),
  ).toBeTruthy();
  expect(screen.getByTestId("current-path").textContent).toBe(
    "/tickets/from-email/TICKET%2042%2FA?source=email#conversation",
  );
  expect(
    screen
      .getByRole("link", { name: "Danh sách yêu cầu" })
      .getAttribute("aria-current"),
  ).toBe("page");
});

it("redirects interview detail links and activates the English schedule link", async () => {
  auth.permissions = { can_hr_rec: true, can_cv_interview: true };
  renderApp("/detail-interview/INT-2026?tab=feedback#notes");
  expect(
    await screen.findByRole("heading", { name: "Chi tiết CV phỏng vấn" }),
  ).toBeTruthy();
  expect(screen.getByTestId("current-path").textContent).toBe(
    "/recruitment/interviews/INT-2026?tab=feedback#notes",
  );
  expect(
    screen.getByRole("link", { name: "Lịch phỏng vấn" }).getAttribute("href"),
  ).toBe("/recruitment/interviews");
  expect(
    screen
      .getByRole("link", { name: "Lịch phỏng vấn" })
      .getAttribute("aria-current"),
  ).toBe("page");
});

it("enforces access rules after redirecting an old settings URL", async () => {
  renderApp("/settings/bophanxuly");
  expect(
    await screen.findByRole("heading", { name: "Bạn chưa có quyền truy cập" }),
  ).toBeTruthy();
  expect(screen.getByTestId("current-path").textContent).toBe("/forbidden");
});

it("redirects the legacy change-status link to the implemented form while preserving query and hash", async () => {
  auth.permissions = { can_return_ticket: true };
  renderApp("/change_status?source=legacy#form");
  expect(
    await screen.findByRole("heading", { name: "Chuyển trạng thái yêu cầu" }),
  ).toBeTruthy();
  expect(
    await screen.findByRole("form", { name: "Chuyển trạng thái yêu cầu" }),
  ).toBeTruthy();
  expect(screen.getByTestId("current-path").textContent).toBe(
    "/requests/change-status?source=legacy#form",
  );
});

it("shows ticketV2 navigation groups according to the account permissions", async () => {
  auth.permissions = {
    can_create: true,
    can_view: true,
    can_accept: true,
    can_process: true,
    can_report: true,
    can_hr_rec: true,
    can_system: true,
    can_allticket: true,
    can_return_ticket: true,
  };
  renderApp();
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
  const sidebar = within(
    screen.getByRole("complementary", { name: "Sidebar Ticket" }),
  );
  for (const label of [
    "Yêu cầu",
    "Danh sách phê duyệt",
    "Nhiệm vụ của tôi",
    "Báo cáo & dữ liệu",
    "Tuyển dụng",
    "Cấu hình hệ thống",
  ]) {
    expect(sidebar.getByText(label)).toBeTruthy();
  }
  expect(sidebar.queryByRole("link", { name: "Tạo yêu cầu" })).toBeNull();
  expect(
    sidebar
      .getByRole("link", { name: "Danh sách yêu cầu" })
      .getAttribute("href"),
  ).toBe("/requests");

  fireEvent.click(sidebar.getByText("Danh sách phê duyệt"));
  fireEvent.click(sidebar.getByRole("link", { name: "Chờ phê duyệt" }));
  expect(
    await screen.findByRole("heading", { name: "Chờ phê duyệt" }),
  ).toBeTruthy();
  expect(
    sidebar
      .getByRole("link", { name: "Chờ phê duyệt" })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(await screen.findByText("Không tìm thấy yêu cầu")).toBeTruthy();
  expect(screen.queryByText("Trang đang được chuẩn bị")).toBeNull();
});

it.each([
  ["/requests", "Danh sách yêu cầu", "can_view"],
  ["/approvals/approved", "Đã phê duyệt", "can_accept"],
  ["/tasks/mine", "Nhiệm vụ cá nhân", "can_process"],
  ["/tasks", "Tất cả nhiệm vụ", "can_process"],
  ["/reports/export", "Truy xuất dữ liệu", "can_export"],
  ["/recruitment/candidates", "Quản lý ứng viên", "can_hr_rec"],
  ["/settings/users", "Người dùng", "can_system"],
  ["/settings/offices", "Văn phòng", "can_system"],
])(
  "opens %s directly and highlights the correct sidebar link",
  async (path, label, permission) => {
    auth.permissions = { [permission]: true };
    renderApp(path);
    expect(await screen.findByRole("heading", { name: label })).toBeTruthy();
    const sidebar = within(
      screen.getByRole("complementary", { name: "Sidebar Ticket" }),
    );
    expect(
      sidebar.getByRole("link", { name: label }).getAttribute("aria-current"),
    ).toBe("page");
    expect(sidebar.queryByRole("link", { name: "Tổng quan" })).toBeNull();
    if (path.startsWith("/settings/")) {
      expect(
        sidebar.queryByRole("link", { name: "Tổng quan cấu hình" }),
      ).toBeNull();
    }
  },
);

it("keeps the request list active while opening a ticket detail URL", async () => {
  auth.permissions = { can_create: true, can_view: true };
  renderApp("/tickets/42?source=legacy#details");
  expect(
    await screen.findByRole("heading", { name: "Chi tiết yêu cầu" }),
  ).toBeTruthy();
  expect(screen.getByTestId("current-path").textContent).toBe(
    "/requests/42?source=legacy#details",
  );
  expect(
    screen
      .getByRole("link", { name: "Danh sách yêu cầu" })
      .getAttribute("aria-current"),
  ).toBe("page");
});

it("does not activate the request list for other static request pages", () => {
  const page = navigationGroups[0].pages[0];
  for (const path of [
    "/requests/new",
    "/requests/all",
    "/requests/change-status",
  ])
    expect(isPageActive(page, path)).toBe(false);
  expect(isPageActive(page, "/requests/42")).toBe(true);
});

it("hides unavailable groups and denies unauthorized direct URLs", async () => {
  auth.permissions = { can_create: true, can_view: true };
  renderApp("/settings/users");
  expect(
    await screen.findByRole("heading", { name: "Bạn chưa có quyền truy cập" }),
  ).toBeTruthy();
  expect(screen.queryByText("Cấu hình hệ thống")).toBeNull();
  expect(screen.queryByText("Tuyển dụng")).toBeNull();
  expect(screen.queryByText("Báo cáo & dữ liệu")).toBeNull();
  expect(screen.queryByRole("link", { name: "Danh sách yêu cầu" })).toBeNull();
  expect(screen.queryByText("Trang đang được chuẩn bị")).toBeNull();
});

it.each(["is_superuser", "is_admin", "is_staff", "is_system_manage"])(
  "does not grant settings access through %s",
  async (flag) => {
    auth.permissions = { [flag]: true };
    renderApp("/settings/users");
    expect(
      await screen.findByRole("heading", {
        name: "Bạn chưa có quyền truy cập",
      }),
    ).toBeTruthy();
    expect(screen.queryByText("Cấu hình hệ thống")).toBeNull();
  },
);

it.each([false, true])(
  "explains the empty sidebar without granting access (collapsed: %s)",
  async (collapsed) => {
    auth.permissions = {};
    localStorage.setItem(
      "ticket.sidebar",
      JSON.stringify({ collapsed, groups: {} }),
    );
    renderApp("/help");
    await screen.findByRole("heading", { name: "Hướng dẫn sử dụng" });
    const sidebar = within(
      screen.getByRole("complementary", { name: "Sidebar Ticket" }),
    );
    const status = sidebar.getByRole("status");
    expect(within(status).getByText("Chưa có mục truy cập")).toBeTruthy();
    expect(
      within(status).getByText(
        "Liên hệ quản trị viên để được cấp quyền cho các mục trong menu.",
      ),
    ).toBeTruthy();
    expect(sidebar.queryByRole("link")).toBeNull();
    if (collapsed)
      expect(status.getAttribute("title")).toContain("Chưa có mục truy cập");
    fireEvent.click(screen.getByRole("button", { name: "Mở menu điều hướng" }));
    const mobile = await screen.findByRole("dialog", {
      name: "Điều hướng Ticket",
    });
    expect(within(mobile).getByRole("status").textContent).toContain(
      "Chưa có mục truy cập",
    );
    expect(within(mobile).queryByRole("link")).toBeNull();
  },
);

it.each(workspacePages)(
  "requires only the functional permission for $path",
  (page) => {
    expect(typeof page.permission).toBe("string");
    expect(page.permission.startsWith("can_")).toBe(true);
    expect(canAccessPage(page, null)).toBe(false);
    expect(
      canAccessPage(page, {
        is_superuser: true,
        is_admin: true,
        is_system_manage: true,
      }),
    ).toBe(false);
    expect(
      canAccessPage(page, { [page.permission]: false, is_superuser: true }),
    ).toBe(false);
    expect(canAccessPage(page, { [page.permission]: true })).toBe(true);
    const otherPermissions = Object.fromEntries(
      workspacePages
        .filter((other) => other.permission !== page.permission)
        .map((other) => [other.permission, true]),
    );
    expect(canAccessPage(page, otherPermissions)).toBe(false);
  },
);

it("blocks ticket detail before rendering its data without can_view", async () => {
  auth.permissions = { can_create: true, is_superuser: true };
  vi.mocked(getRequestDetail).mockClear();
  renderApp("/requests/42");
  expect(
    await screen.findByRole("heading", { name: "Bạn chưa có quyền truy cập" }),
  ).toBeTruthy();
  expect(screen.queryByText("RS-0042")).toBeNull();
  expect(getRequestDetail).not.toHaveBeenCalled();
});

it("collapses the desktop sidebar while retaining accessible navigation", async () => {
  auth.permissions = { can_create: true, can_view: true, can_report: true };
  renderApp();
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
  fireEvent.click(screen.getByRole("button", { name: "Thu gọn sidebar" }));
  const expand = screen.getByRole("button", { name: "Mở rộng sidebar" });
  expect(expand.getAttribute("aria-expanded")).toBe("false");
  const sidebar = within(
    screen.getByRole("complementary", { name: "Sidebar Ticket" }),
  );
  expect(sidebar.getAllByRole("button")).toHaveLength(2);
  expect(sidebar.queryByRole("link")).toBeNull();
  fireEvent.click(sidebar.getByRole("button", { name: "Báo cáo & dữ liệu" }));
  const flyout = await screen.findByRole("dialog", {
    name: "Báo cáo & dữ liệu",
  });
  fireEvent.click(within(flyout).getByRole("link", { name: "Báo cáo" }));
  expect(await screen.findByRole("heading", { name: "Báo cáo" })).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(
    sidebar
      .getByRole("button", { name: "Báo cáo & dữ liệu" })
      .getAttribute("aria-current"),
  ).toBe("true");
  fireEvent.click(expand);
  expect(
    screen
      .getByRole("button", { name: "Thu gọn sidebar" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
});

it("restores sidebar width and explicitly opened or closed groups after remount", async () => {
  auth.permissions = { can_create: true, can_view: true, can_report: true };
  const view = renderApp();
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
  const sidebar = screen.getByRole("complementary", { name: "Sidebar Ticket" });
  const requests = within(sidebar).getByText("Yêu cầu").closest("details")!;
  const reports = within(sidebar)
    .getByText("Báo cáo & dữ liệu")
    .closest("details")!;
  requests.open = false;
  fireEvent(requests, new Event("toggle"));
  reports.open = true;
  fireEvent(reports, new Event("toggle"));
  fireEvent.click(screen.getByRole("button", { name: "Thu gọn sidebar" }));
  view.unmount();
  renderApp();
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
  fireEvent.click(screen.getByRole("button", { name: "Mở rộng sidebar" }));
  const restored = within(
    screen.getByRole("complementary", { name: "Sidebar Ticket" }),
  );
  expect(restored.getByText("Yêu cầu").closest("details")!.open).toBe(false);
  expect(restored.getByText("Báo cáo & dữ liệu").closest("details")!.open).toBe(
    true,
  );
});

it("uses default navigation when saved sidebar preferences are malformed", async () => {
  localStorage.setItem("ticket.sidebar", "invalid-json");
  renderApp();
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
  expect(screen.getByRole("button", { name: "Thu gọn sidebar" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Danh sách yêu cầu" })).toBeTruthy();
});

it("keeps collapsed flyouts permission-filtered and highlights the list for ticket details", async () => {
  renderApp("/tickets/42");
  await screen.findByRole("heading", { name: "Chi tiết yêu cầu" });
  fireEvent.click(screen.getByRole("button", { name: "Thu gọn sidebar" }));
  const sidebar = within(
    screen.getByRole("complementary", { name: "Sidebar Ticket" }),
  );
  expect(sidebar.getAllByRole("button")).toHaveLength(1);
  const trigger = sidebar.getByRole("button", { name: "Yêu cầu" });
  expect(trigger.getAttribute("aria-current")).toBe("true");
  fireEvent.click(trigger);
  const flyout = await screen.findByRole("dialog", { name: "Yêu cầu" });
  expect(within(flyout).getAllByRole("link")).toHaveLength(1);
  expect(
    within(flyout)
      .getByRole("link", { name: "Danh sách yêu cầu" })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(
    within(flyout).queryByRole("link", { name: "Tất cả yêu cầu" }),
  ).toBeNull();
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("opens the mobile drawer and closes it after navigation", async () => {
  auth.permissions = { can_create: true, can_view: true };
  renderApp("/requests/new");
  await screen.findByRole("heading", { name: "Tạo yêu cầu" });
  fireEvent.click(screen.getByRole("button", { name: "Mở menu điều hướng" }));
  const drawer = await screen.findByRole("dialog", {
    name: "Điều hướng Ticket",
  });
  expect(
    within(drawer).queryByRole("link", { name: "Tạo yêu cầu" }),
  ).toBeNull();
  fireEvent.click(
    within(drawer).getByRole("link", { name: "Danh sách yêu cầu" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("closes the mobile drawer using Escape and restores focus to its trigger", async () => {
  renderApp();
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
  const trigger = screen.getByRole("button", { name: "Mở menu điều hướng" });
  fireEvent.click(trigger);
  const drawer = await screen.findByRole("dialog", {
    name: "Điều hướng Ticket",
  });
  fireEvent.keyDown(drawer, { key: "Escape", code: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("closes the mobile drawer at the desktop breakpoint and focuses the visible desktop toggle", async () => {
  let isDesktop = false;
  const changes = new EventTarget();
  const desktopQuery = {
    get matches() {
      return isDesktop;
    },
    media: "(min-width: 1024px)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: changes.addEventListener.bind(changes),
    removeEventListener: changes.removeEventListener.bind(changes),
    dispatchEvent: changes.dispatchEvent.bind(changes),
  };
  const defaultMatchMedia = vi
    .mocked(window.matchMedia)
    .getMockImplementation()!;
  vi.mocked(window.matchMedia).mockImplementation((query) =>
    query === desktopQuery.media ? desktopQuery : defaultMatchMedia(query),
  );
  renderApp();
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
  const desktopToggle = screen.getByRole("button", { name: "Thu gọn sidebar" });
  const brandLink = screen.getByRole("link", {
    name: "Rainscales Ticket home",
  });
  fireEvent.click(screen.getByRole("button", { name: "Mở menu điều hướng" }));
  await screen.findByRole("dialog", { name: "Điều hướng Ticket" });

  act(() => {
    isDesktop = true;
    changes.dispatchEvent(new Event("change"));
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(desktopToggle));
  expect(screen.getByRole("link", { name: "Rainscales Ticket home" })).toBe(
    brandLink,
  );

  act(() => {
    isDesktop = false;
    changes.dispatchEvent(new Event("change"));
  });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it.each([
  "/login",
  "/dashboard",
  "/users",
  "/change-password",
  "/unknown-page",
])("returns signed-in visitors from %s to the request list", async (path) => {
  renderApp(path);
  expect(
    await screen.findByRole("heading", { name: "Danh sách yêu cầu" }),
  ).toBeTruthy();
  expect(screen.getByTestId("current-path").textContent).toBe("/requests");
  expect(screen.queryByRole("heading", { name: "Applications" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "User Management" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Change Password" })).toBeNull();
});

it("opens the user list from the settings root while preserving URL state", async () => {
  auth.permissions = { can_system: true };
  renderApp("/settings?search=abc#records");
  expect(
    await screen.findByRole("heading", { name: "Người dùng" }),
  ).toBeTruthy();
  expect(screen.getByTestId("current-path").textContent).toBe(
    "/settings/users?search=abc#records",
  );
  expect(
    screen.queryByRole("heading", { name: "Tổng quan cấu hình" }),
  ).toBeNull();
});

it.each(
  workspacePages.flatMap((page) => [page.path, ...(page.legacyPaths ?? [])]),
)(
  "denies the canonical or legacy URL %s without fetching page data",
  async (path) => {
    auth.permissions = {
      is_superuser: true,
      is_admin: true,
      is_handling: true,
      can_search: true,
      can_delete: true,
    };
    renderApp(
      path.replace(":ticketID", "42").replace(":codeInterview", "TEST-42"),
    );
    await screen.findByRole("heading", { name: "Bạn chưa có quyền truy cập" });
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(
      screen.queryByRole("complementary", { name: "Sidebar Ticket" }),
    ).toBeNull();
  },
);

it.each(["/", "/login", "/unknown-page"])(
  "waits for fresh permissions before choosing a default from %s",
  async (path) => {
    auth.isInitializing = true;
    auth.permissions = { can_view: true };
    const view = renderApp(path);
    expect(screen.getByTestId("current-path").textContent).toBe(path);
    expect(
      screen.queryByRole("heading", { name: "Danh sách yêu cầu" }),
    ).toBeNull();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    auth = {
      ...auth,
      isInitializing: false,
      permissions: { can_export: true },
    };
    view.rerender(appElement(path));
    await screen.findByRole("heading", { name: "Truy xuất dữ liệu" });
    expect(screen.getByTestId("current-path").textContent).toBe(
      "/reports/export",
    );
  },
);

it("removes sidebar links and blocks the current page immediately after its permission is revoked", async () => {
  auth.permissions = { can_view: true };
  const view = renderApp("/requests");
  await screen.findByRole("heading", { name: "Danh sách yêu cầu" });
  expect(screen.getByRole("link", { name: "Danh sách yêu cầu" })).toBeTruthy();
  auth = { ...auth, permissions: {} };
  view.rerender(appElement("/requests"));
  await screen.findByRole("heading", { name: "Bạn chưa có quyền truy cập" });
  expect(screen.queryByRole("link", { name: "Danh sách yêu cầu" })).toBeNull();
  expect(screen.queryByRole("table")).toBeNull();
});

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: { success: vi.fn(), error: vi.fn() },
}));
