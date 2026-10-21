// @vitest-environment jsdom
import { Blob as NodeBlob } from "node:buffer";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { workspacePages } from "@/app/navigation";
import { COOKIE_TOKEN_KEY } from "@/constants/auth";
import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/context/auth-context";
import { getUserPermissionRequest } from "@/features/auth/api/auth-api";
import { clearAuthSession } from "@/lib/auth-session";
import { getCookie, setCookie } from "@/lib/cookies";
import { downloadFile } from "@/lib/download";
import { getVisibleReportGroups } from "@/features/reports/utils/report-options";
import { WorkspacePage } from "@/pages/workspace";
import {
  reportFixture,
  emptyReportFixture,
  reportGroupFixtures as groups,
  reportTypeFixtures as types,
} from "./fixtures/reports";

vi.mock("@/lib/download", () => ({ downloadFile: vi.fn() }));
const fetchMock = vi.fn<typeof fetch>();
const pagination = { next: null, previous: null };
let client: QueryClient;
let auth: AuthContextValue;
let groupResponse: () => Response | Promise<Response>;
let reportResponse: () => Response | Promise<Response>;
let typeResponse: (group: string) => Response | Promise<Response>;
let exportResponse: () => Response | Promise<Response>;

beforeEach(() => {
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
  clearAuthSession();
  setCookie(COOKIE_TOKEN_KEY, "report-access");
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  auth = {
    token: "report-access",
    username: "Reporter",
    userId: 42,
    avatarUrl: null,
    permissions: { can_report: true, can_export: true },
    userPermission: null,
    isInitializing: false,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    setError: vi.fn(),
    refreshUserPermission: vi.fn(),
  };
  groupResponse = () =>
    Response.json({ ...pagination, count: groups.length, results: groups });
  reportResponse = () => Response.json(reportFixture);
  typeResponse = (group) => {
    const results = types.filter(
      (type) => String(type.handling_group) === group,
    );
    return Response.json({ ...pagination, count: results.length, results });
  };
  exportResponse = () =>
    new Response("PK excel content", {
      headers: { "Content-Type": "application/vnd.ms-excel" },
    });
  fetchMock.mockReset().mockImplementation((input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/list_handling_group/")
      return Promise.resolve(groupResponse());
    if (url.pathname === "/api/list_tickettype/")
      return Promise.resolve(
        typeResponse(url.searchParams.get("handling_group")!),
      );
    if (url.pathname === "/api/report")
      return Promise.resolve(reportResponse());
    if (["/api/export_excel", "/api/export_ticket_type"].includes(url.pathname))
      return Promise.resolve(exportResponse());
    throw new Error(`Unexpected endpoint ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  client.clear();
  clearAuthSession();
});
function renderPage(path = "/reports") {
  const page = workspacePages.find((item) => item.path === path)!;
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <WorkspacePage page={page} />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
function calls(endpoint: string) {
  return fetchMock.mock.calls.filter(
    ([input]) => new URL(String(input)).pathname === endpoint,
  );
}
function body(endpoint: string) {
  const requests = calls(endpoint);
  const payload = requests[requests.length - 1][1]?.body;
  if (!(payload instanceof FormData))
    throw new Error("Expected a multipart request body");
  return Object.fromEntries(payload.entries());
}
async function ready() {
  await screen.findByRole("button", { name: "Tổng yêu cầu: 3 yêu cầu" });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Tra cứu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
}
async function exportReady() {
  await screen.findByRole("combobox", { name: "Loại yêu cầu" });
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Xuất Excel" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
}
async function select(label: string, name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}

async function chooseGroup() {
  await screen.findByRole("combobox", { name: "Bộ phận xử lý" });
  await select("Bộ phận xử lý", "IT");
}
async function lookupReport() {
  await chooseGroup();
  fireEvent.click(screen.getByRole("button", { name: "Tra cứu" }));
}

it.each(["/reports", "/reports/export"])(
  "leaves the handling group unselected on %s without dependent requests or loading indicators",
  async (path) => {
    renderPage(path);
    const group = await screen.findByRole("combobox", {
      name: "Bộ phận xử lý",
    });
    expect(group.textContent).toContain("Chọn bộ phận xử lý");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls("/api/report")).toHaveLength(0);
    expect(calls("/api/list_tickettype/")).toHaveLength(0);
    expect(screen.queryByText("Đang tải báo cáo...")).toBeNull();
    expect(screen.queryByText("Đang tải danh sách...")).toBeNull();
    if (path === "/reports/export") {
      expect(
        screen.getByRole("combobox", { name: "Loại yêu cầu" }).textContent,
      ).toContain("Chọn loại yêu cầu");
      expect(
        screen
          .getByRole("button", { name: "Xuất Excel" })
          .hasAttribute("disabled"),
      ).toBe(true);
      return;
    }
    fireEvent.click(screen.getByRole("button", { name: "Tra cứu" }));
    expect(
      await screen.findByText("Vui lòng chọn bộ phận xử lý."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
    await waitFor(() => expect(calls("/api/export_excel")).toHaveLength(0));
    await select("Bộ phận xử lý", "IT");
    expect(calls("/api/report")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Tra cứu" }));
    await ready();
    expect(calls("/api/report")).toHaveLength(1);
  },
);

it("loads active handling groups before the selected report and renders four report datasets", async () => {
  renderPage();
  await lookupReport();
  await ready();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const first = new URL(String(fetchMock.mock.calls[0][0]));
  expect(Object.fromEntries(first.searchParams)).toEqual({
    columnSort: "id",
    typeSort: "ascend",
    is_active: "true",
    page_size: "1000",
    page: "1",
  });
  const payload = body("/api/report");
  expect(payload.handlinggroup).toBe("3");
  expect(payload.startdate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(
    Number(new Date(String(payload.enddate))) -
      Number(new Date(String(payload.startdate))),
  ).toBe(7 * 86400000);
  expect(
    screen.getByRole("img", { name: "Tỷ lệ đảm nhận: 3 yêu cầu" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "Tỷ lệ yêu cầu đúng thời hạn" }),
  ).toBeTruthy();
  expect(screen.getByRole("img", { name: "Tỷ lệ loại yêu cầu" })).toBeTruthy();
  for (const [, options] of fetchMock.mock.calls) {
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer report-access",
    );
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  }
  expect(
    new Headers(calls("/api/report")[0][1]?.headers).has("Content-Type"),
  ).toBe(false);
  fireEvent.click(screen.getByRole("combobox", { name: "Bộ phận xử lý" }));
  expect(await screen.findByRole("option", { name: "HR" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Inactive" })).toBeNull();
});

it("opens summary details with real record IDs and handles zero-count summaries", async () => {
  renderPage();
  await lookupReport();
  await ready();
  fireEvent.click(
    screen.getByRole("button", { name: "Tổng yêu cầu: 3 yêu cầu" }),
  );
  const dialog = await screen.findByRole("dialog", { name: "Tổng yêu cầu" });
  const link = within(dialog).getByRole("link", { name: "RS-0042" });
  expect(link.getAttribute("href")).toBe("/requests/42");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  fireEvent.click(within(dialog).getByRole("button", { name: "Close dialog" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Chờ xử lý: 0 yêu cầu" }));
  expect(await screen.findByText("Không có yêu cầu chi tiết")).toBeTruthy();
  expect(calls("/api/report")).toHaveLength(1);
});

it("applies draft filters only on lookup, keeps charts mounted under the overlay and refreshes unchanged criteria", async () => {
  renderPage();
  await lookupReport();
  await ready();
  const summary = screen.getByRole("button", {
    name: "Tổng yêu cầu: 3 yêu cầu",
  });
  fireEvent.change(screen.getByLabelText(/Từ ngày/), {
    target: { value: "01/10/2026" },
  });
  fireEvent.change(screen.getByLabelText(/Đến ngày/), {
    target: { value: "19/10/2026" },
  });
  await select("Bộ phận xử lý", "HR");
  expect(calls("/api/report")).toHaveLength(1);
  let finish!: (value: Response) => void;
  reportResponse = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  fireEvent.click(screen.getByRole("button", { name: "Tra cứu" }));
  expect(await screen.findByText("Đang cập nhật báo cáo...")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tổng yêu cầu: 3 yêu cầu" })).toBe(
    summary,
  );
  await waitFor(() => expect(calls("/api/report")).toHaveLength(2));
  expect(body("/api/report")).toEqual({
    startdate: "2026-10-01",
    enddate: "2026-10-19",
    handlinggroup: "4",
  });
  await act(async () => finish(Response.json(reportFixture)));
  await ready();
  reportResponse = () => Response.json(reportFixture);
  fireEvent.click(screen.getByRole("button", { name: "Tra cứu" }));
  await waitFor(() => expect(calls("/api/report")).toHaveLength(3));
});

it("validates date order and required dates before lookup or export", async () => {
  renderPage();
  await lookupReport();
  await ready();
  fireEvent.change(screen.getByLabelText(/Từ ngày/), {
    target: { value: "20/10/2026" },
  });
  fireEvent.change(screen.getByLabelText(/Đến ngày/), {
    target: { value: "10/10/2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tra cứu" }));
  expect(
    await screen.findByText("Ngày kết thúc phải từ ngày bắt đầu trở đi."),
  ).toBeTruthy();
  expect(calls("/api/report")).toHaveLength(1);
  fireEvent.change(screen.getByLabelText(/Từ ngày/), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
  expect(
    await screen.findByText("Vui lòng nhập ngày hợp lệ (DD/MM/YYYY)."),
  ).toBeTruthy();
  expect(calls("/api/export_excel")).toHaveLength(0);
});

it("exports current valid report drafts as multipart and starts a named Excel download", async () => {
  renderPage();
  await lookupReport();
  await ready();
  fireEvent.change(screen.getByLabelText(/Từ ngày/), {
    target: { value: "01/10/2026" },
  });
  fireEvent.change(screen.getByLabelText(/Đến ngày/), {
    target: { value: "19/10/2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
  await screen.findByText("Đã tạo tệp Excel.");
  expect(body("/api/export_excel")).toEqual({
    startdate: "2026-10-01",
    enddate: "2026-10-19",
    handlinggroup: "3",
  });
  expect(downloadFile).toHaveBeenCalledWith(
    expect.any(NodeBlob),
    "Bao_cao_IT_20261001_20261019.xlsx",
  );
  expect(calls("/api/report")).toHaveLength(1);
});

it.each([403, 500])(
  "handles report HTTP %i without losing the session and allows retry",
  async (status) => {
    reportResponse = () =>
      Response.json({ detail: "Report unavailable" }, { status });
    renderPage();
    await lookupReport();
    expect(
      await screen.findByText(/Không tải được báo cáo: Report unavailable/),
    ).toBeTruthy();
    expect(getCookie(COOKIE_TOKEN_KEY)).toBe("report-access");
    reportResponse = () => Response.json(reportFixture);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại báo cáo" }));
    await ready();
  },
);

it("rejects malformed chart tuples and then renders an empty report after retry", async () => {
  reportResponse = () =>
    Response.json({
      ...reportFixture,
      dict_bieudo_03: { Operator: ["100", 1, 1] },
    });
  renderPage();
  await lookupReport();
  expect(await screen.findByText(/Dữ liệu báo cáo không hợp lệ/)).toBeTruthy();
  reportResponse = () => Response.json(emptyReportFixture);
  fireEvent.click(screen.getByRole("button", { name: "Thử lại báo cáo" }));
  expect(
    await screen.findByRole("button", { name: "Tổng yêu cầu: 0 yêu cầu" }),
  ).toBeTruthy();
  expect(screen.getByText("Chưa có dữ liệu đảm nhận")).toBeTruthy();
  expect(screen.getAllByText("Chưa có dữ liệu tỷ lệ")).toHaveLength(2);
});

it("retries invalid group data before fetching any reports", async () => {
  groupResponse = () =>
    Response.json({
      ...pagination,
      count: 1,
      results: [{ ...groups[0], is_manager: "bad" }],
    });
  renderPage();
  expect(
    await screen.findByText(/Dữ liệu bộ phận xử lý không hợp lệ/),
  ).toBeTruthy();
  expect(calls("/api/report")).toHaveLength(0);
  groupResponse = () =>
    Response.json({ ...pagination, count: groups.length, results: groups });
  fireEvent.click(
    screen.getByRole("button", { name: "Thử lại bộ phận xử lý" }),
  );
  await lookupReport();
  await ready();
});

it.each(["/reports", "/reports/export"])(
  "blocks unauthorized %s without fetching any records or lookups",
  (path) => {
    auth.permissions = { can_create: true };
    renderPage(path);
    expect(screen.getByText("Bạn chưa có quyền truy cập")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it("shows a clear empty state when no active groups exist", async () => {
  groupResponse = () => Response.json({ ...pagination, count: 0, results: [] });
  renderPage();
  expect(
    await screen.findByText("Không có bộ phận xử lý phù hợp"),
  ).toBeTruthy();
  expect(calls("/api/report")).toHaveLength(0);
});

it.each([
  ["/reports", { can_export: true, is_superuser: true }],
  ["/reports/export", { can_report: true, is_superuser: true }],
])(
  "denies %s when only the other report permission is granted",
  (path, permissions) => {
    auth.permissions = permissions;
    renderPage(path);
    expect(screen.getByText("Bạn chưa có quyền truy cập")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it("does not expand export scope through the Django superuser flag", () => {
  expect(
    getVisibleReportGroups(
      groups,
      42,
      { can_export: true, is_superuser: true },
      "export",
    ),
  ).toEqual(
    groups.filter((group) => group.is_active && group.is_manager === 42),
  );
});

it("restricts data export to managed groups and requires a selected type", async () => {
  renderPage("/reports/export");
  await chooseGroup();
  await exportReady();
  expect(calls("/api/report")).toHaveLength(0);
  const url = new URL(String(calls("/api/list_tickettype/")[0][0]));
  expect(Object.fromEntries(url.searchParams)).toEqual({
    handling_group: "3",
    page_size: "1000",
    page: "1",
  });
  fireEvent.click(screen.getByRole("combobox", { name: "Bộ phận xử lý" }));
  expect(await screen.findByRole("option", { name: "IT" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "HR" })).toBeNull();
  fireEvent.click(screen.getByRole("option", { name: "IT" }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
  expect(await screen.findByText("Vui lòng chọn loại yêu cầu.")).toBeTruthy();
  expect(calls("/api/export_ticket_type")).toHaveLength(0);
});

it.each(["Tất cả loại yêu cầu", "Thiết bị"])(
  "exports %s with exact V2 data-export fields",
  async (type) => {
    renderPage("/reports/export");
    await chooseGroup();
    await exportReady();
    await select("Loại yêu cầu", type);
    fireEvent.change(screen.getByLabelText(/Từ ngày/), {
      target: { value: "01/10/2026" },
    });
    fireEvent.change(screen.getByLabelText(/Đến ngày/), {
      target: { value: "19/10/2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
    await screen.findByText("Đã tạo tệp Excel.");
    expect(body("/api/export_ticket_type")).toEqual({
      from_date: "2026-10-01",
      to_date: "2026-10-19",
      bophanxuly_id: "3",
      ticket_type_id: type === "Thiết bị" ? "17" : "All",
    });
    expect(downloadFile).toHaveBeenCalledTimes(1);
  },
);

it.each([
  { can_report: true, can_export: true, can_report_all_groups: true },
  { can_export: true, can_report_all_groups: true, is_superuser: true },
])(
  "clears the selected type when privileged users switch groups: %j",
  async (permissions) => {
    auth.permissions = permissions;
    renderPage("/reports/export");
    await chooseGroup();
    await exportReady();
    await select("Loại yêu cầu", "Thiết bị");
    await select("Bộ phận xử lý", "HR");
    await exportReady();
    expect(
      screen.getByRole("combobox", { name: "Loại yêu cầu" }).textContent,
    ).toContain("Chọn loại yêu cầu");
    fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
    expect(await screen.findByText("Vui lòng chọn loại yêu cầu.")).toBeTruthy();
    await select("Loại yêu cầu", "Nhân sự");
    fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
    await screen.findByText("Đã tạo tệp Excel.");
    expect(body("/api/export_ticket_type")).toMatchObject({
      bophanxuly_id: "4",
      ticket_type_id: "23",
    });
  },
);

it("does not fetch type options when the account manages no exportable groups", async () => {
  auth.userId = 999;
  renderPage("/reports/export");
  expect(
    await screen.findByText("Không có bộ phận xử lý phù hợp"),
  ).toBeTruthy();
  expect(calls("/api/list_tickettype/")).toHaveLength(0);
  expect(calls("/api/export_ticket_type")).toHaveLength(0);
});

it("blocks export while type lookup fails and retries it independently", async () => {
  typeResponse = () =>
    Response.json({ detail: "Type unavailable" }, { status: 500 });
  renderPage("/reports/export");
  await chooseGroup();
  expect(
    await screen.findByText(/Không tải được loại yêu cầu: Type unavailable/),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Xuất Excel" }).hasAttribute("disabled"),
  ).toBe(true);
  typeResponse = (group) =>
    Response.json({
      ...pagination,
      count: 1,
      results: types.filter((type) => String(type.handling_group) === group),
    });
  fireEvent.click(screen.getByRole("button", { name: "Thử lại loại yêu cầu" }));
  await exportReady();
  expect(calls("/api/export_ticket_type")).toHaveLength(0);
});

it("hides cross-group and inactive type options and handles an empty lookup", async () => {
  typeResponse = () =>
    Response.json({
      ...pagination,
      count: 2,
      results: [types[1], { ...types[0], is_active: false }],
    });
  renderPage("/reports/export");
  await chooseGroup();
  expect(
    await screen.findByText(
      "Bộ phận này không có loại yêu cầu đang hoạt động.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Xuất Excel" }).hasAttribute("disabled"),
  ).toBe(true);
});

it("prevents duplicate exports, handles JSON no-data without a download and permits manual retry", async () => {
  let finish!: (response: Response) => void;
  exportResponse = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  renderPage("/reports/export");
  await chooseGroup();
  await exportReady();
  await select("Loại yêu cầu", "Thiết bị");
  const form = screen.getByRole("form", { name: "Truy xuất dữ liệu" });
  fireEvent.submit(form);
  fireEvent.submit(form);
  await waitFor(() => expect(calls("/api/export_ticket_type")).toHaveLength(1));
  expect(
    screen
      .getByRole("button", { name: "Đang xuất Excel..." })
      .hasAttribute("disabled"),
  ).toBe(true);
  await act(async () => finish(Response.json({ status: 0 })));
  expect(
    await screen.findByText(
      "Không có dữ liệu để xuất trong khoảng thời gian đã chọn.",
    ),
  ).toBeTruthy();
  expect(downloadFile).not.toHaveBeenCalled();
  exportResponse = () =>
    new Response("PK excel", {
      headers: { "Content-Type": "application/vnd.ms-excel" },
    });
  fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
  await screen.findByText("Đã tạo tệp Excel.");
  expect(calls("/api/export_ticket_type")).toHaveLength(2);
});

it.each([
  new NodeBlob([], { type: "application/vnd.ms-excel" }),
  new NodeBlob(["<html>error</html>"], { type: "text/html" }),
])("rejects empty or non-spreadsheet downloads", async (file) => {
  exportResponse = async () =>
    new Response(await file.text(), { headers: { "Content-Type": file.type } });
  renderPage();
  await lookupReport();
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
  expect(
    await screen.findByText("Tệp Excel nhận được không hợp lệ."),
  ).toBeTruthy();
  expect(downloadFile).not.toHaveBeenCalled();
  expect(getCookie(COOKIE_TOKEN_KEY)).toBe("report-access");
});

it.each([true, false])(
  "derives all-group export access from the AD handling permission (%s)",
  async (admin) => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        infoUser: [42, "Reporter", null],
        userPermission: ["can_report"],
        handlingPermission: admin ? { AD: [] } : {},
        is_handling: false,
        is_superuser: false,
        ls_permission: [],
        ls_department: [],
        ls_cv_status: [],
        ls_ticket_status: [],
      }),
    );
    const user = await getUserPermissionRequest();
    expect(user.permission.can_report_all_groups).toBe(admin);
  },
);

it("does not treat an unassigned group as managed by an unidentified account", () => {
  expect(
    getVisibleReportGroups(
      [{ ...groups[0], is_manager: null }],
      null,
      { can_report: true, can_export: true },
      "export",
    ),
  ).toEqual([]);
});

it("marks every available request type under All, preserves marks during search and exports All", async () => {
  typeResponse = () =>
    Response.json({
      ...pagination,
      count: 4,
      results: [
        types[0],
        { ...types[0], id: 18, name: "Phần mềm" },
        { ...types[0], id: 19, name: "Inactive type", is_active: false },
        types[1],
      ],
    });
  renderPage("/reports/export");
  await chooseGroup();
  await exportReady();
  await select("Loại yêu cầu", "Tất cả loại yêu cầu");
  fireEvent.click(screen.getByRole("combobox", { name: "Loại yêu cầu" }));
  const options = await screen.findAllByRole("option");
  expect(options).toHaveLength(3);
  for (const option of options)
    expect(option.querySelector(".lucide-check")).not.toBeNull();
  expect(screen.queryByRole("option", { name: "Inactive type" })).toBeNull();
  expect(screen.queryByRole("option", { name: "Nhân sự" })).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Tìm loại yêu cầu" }), {
    target: { value: "phan mem" },
  });
  const matching = await screen.findByRole("option", { name: "Phần mềm" });
  expect(matching.querySelector(".lucide-check")).not.toBeNull();
  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
  fireEvent.keyDown(
    screen.getByRole("combobox", { name: "Tìm loại yêu cầu" }),
    { key: "Escape" },
  );
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
  await screen.findByText("Đã tạo tệp Excel.");
  expect(body("/api/export_ticket_type").ticket_type_id).toBe("All");
});
it("returns to one check when selecting an individual type and resets All when changing groups", async () => {
  auth.permissions = {
    can_report: true,
    can_export: true,
    can_report_all_groups: true,
  };
  typeResponse = (group) =>
    Response.json({
      ...pagination,
      count: 2,
      results:
        group === "3"
          ? [types[0], { ...types[0], id: 18, name: "Phần mềm" }]
          : [types[1]],
    });
  renderPage("/reports/export");
  await chooseGroup();
  await exportReady();
  await select("Loại yêu cầu", "Tất cả loại yêu cầu");
  await select("Loại yêu cầu", "Phần mềm");
  fireEvent.click(screen.getByRole("combobox", { name: "Loại yêu cầu" }));
  expect(
    (await screen.findByRole("option", { name: "Phần mềm" })).querySelector(
      ".lucide-check",
    ),
  ).not.toBeNull();
  for (const name of ["Thiết bị", "Tất cả loại yêu cầu"])
    expect(
      screen.getByRole("option", { name }).querySelector(".lucide-check"),
    ).toBeNull();
  fireEvent.click(screen.getByRole("option", { name: "Tất cả loại yêu cầu" }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  await select("Bộ phận xử lý", "HR");
  await exportReady();
  fireEvent.click(screen.getByRole("combobox", { name: "Loại yêu cầu" }));
  const options = await screen.findAllByRole("option");
  expect(options).toHaveLength(2);
  for (const option of options)
    expect(option.querySelector(".lucide-check")).toBeNull();
});
