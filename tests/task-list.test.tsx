// @vitest-environment jsdom
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
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { addDays, format, startOfToday } from "date-fns";
import { workspacePages } from "@/app/navigation";
import { COOKIE_TOKEN_KEY } from "@/constants/auth";
import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/context/auth-context";
import { clearAuthSession } from "@/lib/auth-session";
import { getCookie, setCookie } from "@/lib/cookies";
import { WorkspaceRoute } from "./fixtures/workspace-route";
import { RequestTable } from "@/features/requests/components/request-table";
import {
  requestTicketFixture as ticket,
  requestStatusFixtures as statuses,
  requestTypeFixtures as types,
  requestTeamFixtures as teams,
} from "./fixtures/requests";

const pages = [
  {
    path: "/tasks/mine",
    label: "Nhiệm vụ cá nhân",
    endpoint: "/api/list_ticket_personal/",
    prefix: "PERSONAL",
    typeKey: "ticket_type_name",
    typeValue: "Thiết bị",
    userLabel: "Người phê duyệt",
    userKey: "approve_user_name",
  },
  {
    path: "/tasks",
    label: "Tất cả nhiệm vụ",
    endpoint: "/api/list_ticket_all/",
    prefix: "TASK-ALL",
    typeKey: "ticket_type_id",
    typeValue: "17",
    userLabel: "Người xử lý",
    userKey: "list_user_received",
  },
] as const;
const fetchMock = vi.fn<typeof fetch>();
let client: QueryClient;
let auth: AuthContextValue;
let responses: Record<string, () => Response | Promise<Response>>;
const listData = (prefix: string) => ({
  count: 350,
  next: null,
  previous: null,
  results: [
    { ...ticket, ticket_code: `${prefix}-42`, list_user_received: "Support" },
  ],
});

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
  clearAuthSession();
  setCookie(COOKIE_TOKEN_KEY, "task-access");
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  auth = {
    token: "task-access",
    username: "Operator",
    userId: 42,
    avatarUrl: null,
    permissions: { can_process: true },
    userPermission: null,
    isInitializing: false,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    setError: vi.fn(),
    refreshUserPermission: vi.fn(),
  };
  responses = {
    "/api/list_ticket_personal/": () => Response.json(listData("PERSONAL")),
    "/api/list_ticket_all/": () => Response.json(listData("TASK-ALL")),
    "/api/list_ticketstatus/": () =>
      Response.json({
        next: null,
        previous: null,
        count: 3,
        results: [
          { ...statuses[0], id: 1, name: "Trạng thái ẩn" },
          ...statuses,
        ],
      }),
    "/api/list_handling_tickettype/": () => Response.json(types),
    "/api/list_team/": () => Response.json(teams),
  };
  fetchMock.mockReset().mockImplementation((input) => {
    const endpoint = new URL(String(input)).pathname;
    if (!responses[endpoint])
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    return Promise.resolve(responses[endpoint]());
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  client.clear();
  clearAuthSession();
});

function CurrentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const page = workspacePages.find((item) => item.path === location.pathname);
  return (
    <>
      <WorkspaceRoute page={page} />
      <output data-testid="location">
        {location.pathname}
        {location.search}
      </output>
      <button onClick={() => navigate(-1)}>Back</button>
      <button onClick={() => navigate("/tasks/mine")}>
        Open personal tasks
      </button>
      <button onClick={() => navigate("/tasks")}>Open all tasks</button>
    </>
  );
}
function renderPage(path: string) {
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <CurrentPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
function calls(endpoint: string) {
  return fetchMock.mock.calls.filter(
    ([url]) => new URL(String(url)).pathname === endpoint,
  );
}
function params(endpoint: string) {
  const requests = calls(endpoint);
  return Object.fromEntries(
    new URL(String(requests[requests.length - 1][0])).searchParams,
  );
}
async function ready(label: string) {
  await screen.findByRole("table", { name: label });
  await waitFor(() =>
    expect(
      screen
        .getByRole("region", { name: "Kết quả yêu cầu" })
        .getAttribute("aria-busy"),
    ).toBe("false"),
  );
}
async function select(label: string, name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}

it.each(pages)(
  "highlights active tasks due today or earlier on $path using the V2 rule",
  async ({ path, label, endpoint }) => {
    const today = startOfToday();
    const cases = [
      ...[1, 2, 3, 6].map((status) => ({
        status,
        date: format(addDays(today, -1), "yyyy-MM-dd"),
        red: true,
      })),
      ...[4, 5, 7].map((status) => ({
        status,
        date: format(addDays(today, -1), "yyyy-MM-dd"),
        red: false,
      })),
      { status: 2, date: format(today, "yyyy-MM-dd"), red: true },
      { status: 2, date: format(addDays(today, 1), "yyyy-MM-dd"), red: false },
      { status: 2, date: "", red: false },
      { status: 2, date: "invalid", red: false },
    ];
    responses[endpoint] = () =>
      Response.json({
        count: cases.length,
        next: null,
        previous: null,
        results: cases.map((test, index) => ({
          ...ticket,
          id: 100 + index,
          ticket_code: `DUE-${index}`,
          ticket_status: test.status,
          duedate: test.date,
        })),
      });
    renderPage(path);
    await ready(label);
    for (const [index, test] of cases.entries()) {
      const row = screen
        .getByRole("link", { name: `DUE-${index}` })
        .closest("tr")!;
      expect(row.classList.contains("bg-danger-soft")).toBe(test.red);
      if (test.red)
        expect(row.classList.contains("hover:bg-danger-soft")).toBe(true);
    }
  },
);

it("keeps the created-request list styling unchanged for an overdue active ticket", () => {
  render(
    <MemoryRouter>
      <RequestTable
        rows={[{ ...ticket, ticket_status: 2, duedate: "2000-01-01" }]}
        rowOffset={0}
        scope="created"
      />
    </MemoryRouter>,
  );
  expect(
    screen
      .getByRole("link", { name: ticket.ticket_code })
      .closest("tr")
      ?.classList.contains("bg-danger-soft"),
  ).toBe(false);
});

it.each(pages)(
  "loads $label through its V2 endpoint, handling lookups and twelve columns",
  async ({ path, label, endpoint, prefix, userLabel }) => {
    renderPage(path);
    await ready(label);
    expect(params(endpoint)).toEqual({
      page: "1",
      page_size: "100",
      columnSort: "id",
      typeSort: "descend",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options?.method).toBe("GET");
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      expect(new Headers(options?.headers).get("Authorization")).toBe(
        "Bearer task-access",
      );
    }
    const table = within(screen.getByRole("table"));
    expect(
      table.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "#",
      "Mã yêu cầu",
      "Loại yêu cầu",
      "Tiêu đề",
      "Department",
      "Team",
      "Văn phòng",
      "Ngày mong muốn",
      userLabel,
      "Trạng thái",
      "Cập nhật bởi",
      "Ngày tạo",
    ]);
    expect(table.getByText("19/10/2026")).toBeTruthy();
    expect(table.getByText("Frontend, Backend")).toBeTruthy();
    expect(
      table.getByRole("link", { name: `${prefix}-42` }).getAttribute("href"),
    ).toBe("/requests/42");
    expect(screen.queryByRole("link", { name: "Tạo yêu cầu" })).toBeNull();
    fireEvent.click(table.getByText("Thiết bị"));
    expect(screen.getByTestId("location").textContent).toBe("/requests/42");
  },
);

it.each(pages)(
  "uses searchable status IDs and ignores unsafe or cross-scope controls on $label",
  async ({ path, label, endpoint }) => {
    renderPage(
      `${path}?page=2&typeView=create&ticket_status_name=wrong&ticket_status=unsafe&ticket_type_id=-9&team_id=1,bad&type_option=99&username_create=wrong`,
    );
    await ready(label);
    expect(params(endpoint)).toEqual({
      page: "2",
      page_size: "100",
      columnSort: "id",
      typeSort: "descend",
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Trạng thái" }));
    expect(screen.queryByRole("option", { name: "Trạng thái ẩn" })).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Tìm trạng thái" }), {
      target: { value: "hoan thanh" },
    });
    fireEvent.click(await screen.findByRole("option", { name: "Hoàn thành" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(calls(endpoint)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    await waitFor(() => expect(params(endpoint).ticket_status).toBe("9"));
    expect(params(endpoint).ticket_status_name).toBeUndefined();
    expect(params(endpoint).page).toBe("1");
  },
);

it.each(pages)(
  "applies $label type, Department, multiple teams and creation dates using exact API fields",
  async ({ path, label, endpoint, typeKey, typeValue, userLabel, userKey }) => {
    renderPage(`${path}?page=2`);
    await ready(label);
    fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
    await select("Loại yêu cầu", "IT - Thiết bị");
    fireEvent.change(screen.getByLabelText("Department"), {
      target: { value: " Kỹ thuật " },
    });
    fireEvent.change(screen.getByLabelText(userLabel), {
      target: { value: " Operator " },
    });
    fireEvent.change(screen.getByLabelText("Ngày tạo từ"), {
      target: { value: "01/10/2026" },
    });
    fireEvent.change(screen.getByLabelText("Ngày tạo đến"), {
      target: { value: "31/10/2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Team" }));
    fireEvent.click(await screen.findByRole("button", { name: "Frontend" }));
    fireEvent.click(screen.getByRole("button", { name: "Backend" }));
    fireEvent.keyDown(
      document.querySelector('[data-slot="popover-content"]')!,
      { key: "Escape", code: "Escape" },
    );
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="popover-content"]'),
      ).toBeNull(),
    );
    expect(screen.getByRole("dialog", { name: "Lọc nâng cao" })).toBeTruthy();
    await select("Nhóm nhiệm vụ", "Đang xử lý");
    if (path === "/tasks") await select("Gắn thẻ", "Được gắn thẻ");
    expect(calls(endpoint)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    await waitFor(() => expect(params(endpoint).team_id).toBe("1,2"));
    await ready(label);
    expect(params(endpoint)).toMatchObject({
      page: "1",
      [typeKey]: typeValue,
      [userKey]: "Operator",
      bophansudung_name: "Kỹ thuật",
      created_from: "2026-10-01",
      created_to: "2026-10-31",
      typeView: "processing",
    });
    if (path === "/tasks") {
      expect(params(endpoint)["type_option[]"]).toBe("0");
      expect(params(endpoint).type_option).toBeUndefined();
    }
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    await ready(label);
    expect(params(endpoint)).toEqual({
      page: "1",
      page_size: "100",
      columnSort: "id",
      typeSort: "descend",
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await ready(label);
    fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
    expect(
      screen.getByRole("button", { name: "Remove Frontend" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Backend" })).toBeTruthy();
    expect(
      (screen.getByLabelText("Ngày tạo từ") as HTMLInputElement).value,
    ).toBe("01/10/2026");
  },
);

it.each(pages)(
  "keeps saved task views and tags while searching $label, but clears other advanced filters",
  async ({ path, label, endpoint, typeKey, typeValue }) => {
    const query = new URLSearchParams({
      typeView: "received",
      type_option: "0",
      [typeKey]: typeValue,
      team_id: "1,2,1",
      created_from: "2026-10-01",
      ticket_status: "7",
    });
    renderPage(`${path}?${query}`);
    await ready(label);
    expect(params(endpoint).team_id).toBe("1,2");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: " laptop " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    await waitFor(() => expect(params(endpoint).searchAll).toBe("laptop"));
    expect(params(endpoint)).toMatchObject({
      page: "1",
      typeView: "received",
      ticket_status: "7",
    });
    expect(params(endpoint)[typeKey]).toBeUndefined();
    expect(params(endpoint).team_id).toBeUndefined();
    expect(params(endpoint).created_from).toBeUndefined();
    expect(params(endpoint)["type_option[]"]).toBe(
      path === "/tasks" ? "0" : undefined,
    );
  },
);

it.each(pages)(
  "retains $label rows while paging, resets vertical scroll and supports 200 per page",
  async ({ path, label, endpoint, prefix }) => {
    renderPage(path);
    await ready(label);
    const table = screen.getByRole("table");
    const scroll = screen.getByRole("region", { name: "Cuộn bảng yêu cầu" });
    scroll.scrollTop = 450;
    scroll.scrollLeft = 160;
    let finish!: (response: Response) => void;
    responses[endpoint] = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(await screen.findByText("Đang cập nhật danh sách...")).toBeTruthy();
    expect(screen.getByRole("table")).toBe(table);
    expect(scroll.scrollTop).toBe(0);
    expect(scroll.scrollLeft).toBe(160);
    expect(params(endpoint).page).toBe("2");
    await act(async () => finish(Response.json(listData(prefix))));
    await ready(label);
    expect(within(table).getByRole("cell", { name: "101" })).toBeTruthy();
    responses[endpoint] = () => Response.json(listData(prefix));
    fireEvent.click(
      screen.getByRole("combobox", { name: "Số yêu cầu mỗi trang" }),
    );
    const option = await screen.findByRole("option", { name: "200 / trang" });
    fireEvent.pointerDown(option, { pointerType: "mouse" });
    fireEvent.click(option);
    await waitFor(() => expect(params(endpoint).page_size).toBe("200"));
    expect(params(endpoint).page).toBe("1");
  },
);

it.each(pages)(
  "keeps $label accessible when lookup responses fail and retries them independently",
  async ({ path, label, endpoint }) => {
    responses["/api/list_team/"] = () =>
      Response.json([{ ...teams[0], id: "bad" }]);
    responses["/api/list_handling_tickettype/"] = () =>
      Response.json({ detail: "Type unavailable" }, { status: 500 });
    renderPage(path);
    await ready(label);
    expect(
      await screen.findByText(/Không tải được Team: Dữ liệu Team không hợp lệ/),
    ).toBeTruthy();
    expect(screen.getByText(/Không tải được loại yêu cầu/)).toBeTruthy();
    expect(getCookie(COOKIE_TOKEN_KEY)).toBe("task-access");
    responses["/api/list_team/"] = () => Response.json(teams);
    responses["/api/list_handling_tickettype/"] = () => Response.json(types);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại Team" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Thử lại loại yêu cầu" }),
    );
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(calls(endpoint)).toHaveLength(1);
  },
);

it.each(pages)(
  "handles API errors, invalid task data and empty results on $label",
  async ({ path, label, endpoint }) => {
    responses[endpoint] = () =>
      Response.json({ detail: "Task unavailable" }, { status: 403 });
    renderPage(path);
    expect(
      await screen.findByText(/Không tải được yêu cầu: Task unavailable/),
    ).toBeTruthy();
    expect(getCookie(COOKIE_TOKEN_KEY)).toBe("task-access");
    responses[endpoint] = () =>
      Response.json({
        count: 1,
        next: null,
        previous: null,
        results: [{ ...ticket, created: null }],
      });
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(
      await screen.findByText(/Dữ liệu danh sách yêu cầu không hợp lệ/),
    ).toBeTruthy();
    responses[endpoint] = () =>
      Response.json({ count: 0, next: null, previous: null, results: [] });
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Không tìm thấy yêu cầu")).toBeTruthy();
    expect(screen.queryByRole("table", { name: label })).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Phân trang yêu cầu" }),
    ).toBeNull();
  },
);

it.each(pages)(
  "does not fetch $label records or options without can_process",
  ({ path }) => {
    auth.permissions = {
      can_create: true,
      can_accept: true,
      can_allticket: true,
    };
    renderPage(path);
    expect(screen.getByText("Bạn chưa có quyền truy cập")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it("isolates personal and all-task caches with explicit task permission during navigation", async () => {
  auth.permissions = { can_process: true };
  renderPage("/tasks/mine");
  await ready("Nhiệm vụ cá nhân");
  let finish!: (response: Response) => void;
  responses["/api/list_ticket_all/"] = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  fireEvent.click(screen.getByRole("button", { name: "Open all tasks" }));
  expect(await screen.findByText("Đang tải yêu cầu...")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "PERSONAL-42" })).toBeNull();
  await waitFor(() => expect(calls("/api/list_ticket_all/")).toHaveLength(1));
  await act(async () => finish(Response.json(listData("TASK-ALL"))));
  await ready("Tất cả nhiệm vụ");
  expect(screen.getByRole("link", { name: "TASK-ALL-42" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "PERSONAL-42" })).toBeNull();
});
