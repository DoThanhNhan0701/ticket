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
import { workspacePages } from "@/app/navigation";
import { COOKIE_TOKEN_KEY } from "@/constants/auth";
import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/context/auth-context";
import { clearAuthSession } from "@/lib/auth-session";
import { getCookie, setCookie } from "@/lib/cookies";
import { WorkspacePage } from "@/pages/workspace";
import {
  requestStatusFixtures,
  requestTicketFixture,
} from "./fixtures/requests";

const fetchMock = vi.fn<typeof fetch>();
const ticket = requestTicketFixture;
const statuses = requestStatusFixtures;
const pagination = { next: null, previous: null };
let client: QueryClient;
let auth: AuthContextValue;
let listResponse: () => Response | Promise<Response>;
let statusResponse: () => Response | Promise<Response>;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
  clearAuthSession();
  setCookie(COOKIE_TOKEN_KEY, "request-access");
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  auth = {
    token: "request-access",
    username: "Requester",
    userId: 42,
    avatarUrl: null,
    permissions: { can_create: true },
    userPermission: null,
    isInitializing: false,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    setError: vi.fn(),
    refreshUserPermission: vi.fn(),
  };
  listResponse = () =>
    Response.json({ ...pagination, count: 250, results: [ticket] });
  statusResponse = () =>
    Response.json({ ...pagination, count: statuses.length, results: statuses });
  fetchMock.mockReset().mockImplementation((input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/list_ticket/")
      return Promise.resolve(listResponse());
    if (url.pathname === "/api/list_ticketstatus/")
      return Promise.resolve(statusResponse());
    throw new Error(`Unexpected endpoint: ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  client.clear();
  clearAuthSession();
});

function LocationControls() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">
        {location.pathname}
        {location.search}
      </output>
      <button onClick={() => navigate(-1)}>Back</button>
    </>
  );
}

function renderList(path = "/requests") {
  const page = workspacePages.find((item) => item.path === "/requests")!;
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <WorkspacePage page={page} />
          <LocationControls />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

function listCalls() {
  return fetchMock.mock.calls.filter(
    ([url]) => new URL(String(url)).pathname === "/api/list_ticket/",
  );
}

function lastParams() {
  const calls = listCalls();
  return Object.fromEntries(
    new URL(String(calls[calls.length - 1][0])).searchParams,
  );
}

async function ready() {
  await screen.findByRole("table", { name: "Danh sách yêu cầu" });
  await waitFor(() =>
    expect(
      screen
        .getByRole("region", { name: "Kết quả yêu cầu" })
        .getAttribute("aria-busy"),
    ).toBe("false"),
  );
}

async function selectOption(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  const item = await screen.findByRole("option", { name: option });
  fireEvent.pointerDown(item, { pointerType: "mouse" });
  fireEvent.click(item);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}

it("loads the ticketV2 list and status endpoints with bearer authentication and renders all ten columns", async () => {
  renderList();
  await ready();
  expect(lastParams()).toEqual({
    page: "1",
    page_size: "100",
    columnSort: "id",
    typeSort: "descend",
    typeView: "create",
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  for (const [, options] of fetchMock.mock.calls) {
    expect(options?.method).toBe("GET");
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer request-access",
    );
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  }
  const table = within(screen.getByRole("table"));
  expect(table.getAllByRole("columnheader")).toHaveLength(10);
  for (const value of [
    "RS-0042",
    "Cấp máy tính mới",
    "Thiết bị",
    "Kỹ thuật",
    "Frontend, Backend",
    "Đà Nẵng",
    "21/10/2026",
    "Nguyễn An",
    "Đang xử lý",
    "Trần Bình",
  ])
    expect(table.getByText(value)).toBeTruthy();
  expect(
    table.getByRole("link", { name: "RS-0042" }).getAttribute("href"),
  ).toBe("/tickets/42");
  expect(
    screen.getByRole("link", { name: "Tạo yêu cầu" }).getAttribute("href"),
  ).toBe("/requests/new");
  fireEvent.click(table.getByText("Thiết bị"));
  expect(screen.getByTestId("location").textContent).toBe("/tickets/42");
});

it("requests the next page and resets pagination when changing page size", async () => {
  renderList();
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  await waitFor(() => expect(lastParams().page).toBe("2"));
  await ready();
  expect(screen.getByText("Trang 2 / 3")).toBeTruthy();
  await selectOption("Số yêu cầu mỗi trang", "200 / trang");
  await waitFor(() =>
    expect(lastParams()).toMatchObject({
      page: "1",
      page_size: "200",
      typeView: "create",
    }),
  );
  await ready();
  fireEvent.change(screen.getByLabelText("Đến trang"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Đến trang" }));
  await waitFor(() => expect(lastParams().page).toBe("2"));
});

it.each(["search", "page"])(
  "keeps the table mounted under a loading overlay during %s",
  async (action) => {
    renderList();
    await ready();
    const table = screen.getByRole("table", { name: "Danh sách yêu cầu" });
    let finish!: (response: Response) => void;
    listResponse = () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      });
    if (action === "search") {
      fireEvent.change(
        screen.getByRole("searchbox", { name: "Tìm kiếm yêu cầu" }),
        { target: { value: "laptop" } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    } else {
      fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    }
    expect(await screen.findByText("Đang cập nhật danh sách...")).toBeTruthy();
    expect(screen.getByRole("table")).toBe(table);
    expect(within(table).getByText(ticket.ticket_code)).toBeTruthy();
    expect(screen.queryByText("Đang tải yêu cầu...")).toBeNull();
    expect(
      screen
        .getByRole("region", { name: "Kết quả yêu cầu" })
        .getAttribute("aria-busy"),
    ).toBe("true");
    expect(
      (screen.getByRole("button", { name: "Trang sau" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await waitFor(() => expect(listCalls()).toHaveLength(2));
    await act(async () =>
      finish(
        Response.json({
          ...pagination,
          count: 250,
          results: [{ ...ticket, ticket_code: "RS-UPDATED" }],
        }),
      ),
    );
    expect(
      await screen.findByRole("link", { name: "RS-UPDATED" }),
    ).toBeTruthy();
    await ready();
    expect(screen.queryByText("Đang cập nhật danh sách...")).toBeNull();
    expect(screen.getByRole("table")).toBe(table);
  },
);

it("submits trimmed quick search, clears advanced filters, preserves status and restores filters on Back", async () => {
  renderList("/requests?page=2&title=old&ticket_status_name=Đang+xử+lý");
  await ready();
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Tìm kiếm yêu cầu" }),
    { target: { value: "  Máy & mạng + VPN  " } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() =>
    expect(lastParams()).toMatchObject({
      page: "1",
      searchAll: "Máy & mạng + VPN",
      ticket_status_name: "Đang xử lý",
    }),
  );
  expect(lastParams().title).toBeUndefined();
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  await waitFor(() =>
    expect(screen.getByRole("searchbox").getAttribute("value")).toBe(""),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Tiêu đề").getAttribute("value")).toBe("old"),
  );
  expect(
    new URLSearchParams(
      screen.getByTestId("location").textContent?.split("?")[1],
    ).get("page"),
  ).toBe("2");
});

it.each(["close", "Escape"])(
  "opens advanced filters on demand and discards unapplied edits on %s",
  async (action) => {
    renderList("/requests?title=applied");
    await ready();
    expect(screen.queryByRole("dialog")).toBeNull();
    const trigger = screen.getByRole("button", { name: "Lọc nâng cao" });
    fireEvent.click(trigger);
    const drawer = await screen.findByRole("dialog", { name: "Lọc nâng cao" });
    fireEvent.change(within(drawer).getByLabelText("Tiêu đề"), {
      target: { value: "draft" },
    });
    expect(listCalls()).toHaveLength(1);
    if (action === "Escape")
      fireEvent.keyDown(drawer, { key: "Escape", code: "Escape" });
    else
      fireEvent.click(
        within(drawer).getByRole("button", { name: "Đóng bộ lọc nâng cao" }),
      );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(lastParams().title).toBe("applied");
    fireEvent.click(trigger);
    const reopened = await screen.findByRole("dialog", {
      name: "Lọc nâng cao",
    });
    expect(
      (within(reopened).getByLabelText("Tiêu đề") as HTMLInputElement).value,
    ).toBe("applied");
  },
);

it("clears advanced filters from the drawer while preserving quick search and status", async () => {
  renderList(
    "/requests?page=2&title=applied&searchAll=laptop&ticket_status_name=Đang+xử+lý",
  );
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
  const drawer = await screen.findByRole("dialog", { name: "Lọc nâng cao" });
  fireEvent.click(
    within(drawer).getByRole("button", { name: "Xóa bộ lọc nâng cao" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() =>
    expect(lastParams()).toMatchObject({
      page: "1",
      searchAll: "laptop",
      ticket_status_name: "Đang xử lý",
    }),
  );
  expect(lastParams().title).toBeUndefined();
});

it("applies a draft status by name only on search and omits the all-status value", async () => {
  renderList("/requests?page=2");
  await ready();
  await selectOption("Trạng thái", "Hoàn thành");
  expect(listCalls()).toHaveLength(1);
  expect(lastParams()).toMatchObject({ page: "2" });
  expect(lastParams().ticket_status_name).toBeUndefined();
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() =>
    expect(lastParams()).toMatchObject({
      page: "1",
      ticket_status_name: "Hoàn thành",
    }),
  );
  await ready();
  await selectOption("Trạng thái", "Tất cả trạng thái");
  expect(listCalls()).toHaveLength(2);
  expect(lastParams().ticket_status_name).toBe("Hoàn thành");
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() => expect(lastParams().ticket_status_name).toBeUndefined());
});

it("submits keyword and status together and restores both from browser history", async () => {
  renderList("/requests?page=2&searchAll=old&ticket_status_name=Đang+xử+lý");
  await ready();
  await selectOption("Trạng thái", "Hoàn thành");
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Tìm kiếm yêu cầu" }),
    { target: { value: "  laptop  " } },
  );
  expect(listCalls()).toHaveLength(1);
  fireEvent.submit(screen.getByRole("search", { name: "Tìm kiếm yêu cầu" }));
  await waitFor(() =>
    expect(lastParams()).toMatchObject({
      page: "1",
      searchAll: "laptop",
      ticket_status_name: "Hoàn thành",
    }),
  );
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  await waitFor(() =>
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
      "old",
    ),
  );
  expect(
    screen.getByRole("combobox", { name: "Trạng thái" }).textContent,
  ).toContain("Đang xử lý");
  await ready();
  const callsBeforeClear = listCalls().length;
  fireEvent.click(
    screen.getByRole("button", { name: "Clear tìm kiếm yêu cầu" }),
  );
  expect(listCalls()).toHaveLength(callsBeforeClear);
  expect(lastParams().searchAll).toBe("old");
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() => expect(lastParams().searchAll).toBeUndefined());
  expect(lastParams().ticket_status_name).toBe("Đang xử lý");
});

it("applies advanced fields using the backend names and YYYY-MM-DD date format", async () => {
  renderList("/requests?page=2");
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
  const fields = {
    "Mã yêu cầu": "RS-00",
    "Loại yêu cầu": "Thiết bị",
    "Tiêu đề": "máy mới",
    "Văn phòng": "Đà Nẵng",
    "Ngày mong muốn": "21/10/2026",
    "Người phê duyệt": "Nguyễn An",
    "Cập nhật bởi": "Trần Bình",
  };
  for (const [label, value] of Object.entries(fields))
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Lọc nâng cao" })).toBeNull(),
  );
  await waitFor(() =>
    expect(lastParams()).toMatchObject({
      page: "1",
      ticket_code: "RS-00",
      ticket_type_name: "Thiết bị",
      title: "máy mới",
      vanphong_name: "Đà Nẵng",
      duedate: "2026-10-21",
      approve_user_name: "Nguyễn An",
      updating_user_name: "Trần Bình",
    }),
  );
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Xóa tất cả bộ lọc" }));
  await waitFor(() =>
    expect(lastParams()).toEqual({
      page: "1",
      page_size: "100",
      columnSort: "id",
      typeSort: "descend",
      typeView: "create",
    }),
  );
});

it("ignores saved sort controls and keeps the backend's required default ordering", async () => {
  renderList("/requests?page=2&columnSort=ticket_type_name&typeSort=ascend");
  await ready();
  const table = within(screen.getByRole("table"));
  expect(table.queryByRole("button")).toBeNull();
  for (const header of table.getAllByRole("columnheader"))
    expect(header.hasAttribute("aria-sort")).toBe(false);
  expect(lastParams()).toMatchObject({
    page: "2",
    columnSort: "id",
    typeSort: "descend",
  });
  await selectOption("Số yêu cầu mỗi trang", "200 / trang");
  await waitFor(() => expect(lastParams().page_size).toBe("200"));
  expect(screen.getByTestId("location").textContent).not.toContain(
    "columnSort",
  );
  expect(screen.getByTestId("location").textContent).not.toContain("typeSort");
});

it("selects a future due date with the shared calendar and submits its ISO date", async () => {
  renderList("/requests?page=2&duedate=2027-10-21");
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
  expect(
    (screen.getByLabelText("Ngày mong muốn") as HTMLInputElement).value,
  ).toBe("21/10/2027");
  fireEvent.click(
    screen.getByRole("button", { name: "Choose ngày mong muốn" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /October 22nd, 2027/ }),
  );
  expect(
    (screen.getByLabelText("Ngày mong muốn") as HTMLInputElement).value,
  ).toBe("22/10/2027");
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
  await waitFor(() =>
    expect(lastParams()).toMatchObject({ page: "1", duedate: "2027-10-22" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Lọc nâng cao" })).toBeNull(),
  );
});

it("normalizes invalid URL controls and prevents URL params from overriding the list scope", async () => {
  renderList(
    "/requests?page=-9&page_size=999&columnSort=unknown&typeSort=unknown&typeView=all&ticket_status_name=all&unknown=value",
  );
  await ready();
  expect(lastParams()).toEqual({
    page: "1",
    page_size: "100",
    columnSort: "id",
    typeSort: "descend",
    typeView: "create",
  });
});

it.each([500, 403])(
  "shows a retryable list error for HTTP %i while keeping the session",
  async (status) => {
    listResponse = () =>
      Response.json(
        { detail: "Danh sách tạm thời không khả dụng" },
        { status },
      );
    renderList();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen.getByText(
        /Không tải được yêu cầu: Danh sách tạm thời không khả dụng/,
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Không tìm thấy yêu cầu")).toBeNull();
    expect(getCookie(COOKIE_TOKEN_KEY)).toBe("request-access");
    listResponse = () =>
      Response.json({ ...pagination, count: 1, results: [ticket] });
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await ready();
    expect(screen.queryByRole("alert")).toBeNull();
  },
);

it("keeps tickets visible when the status endpoint fails and retries it independently", async () => {
  statusResponse = () =>
    Response.json({ detail: "Status unavailable" }, { status: 500 });
  renderList();
  await ready();
  expect(await screen.findByText(/Không tải được trạng thái/)).toBeTruthy();
  statusResponse = () =>
    Response.json({ ...pagination, count: statuses.length, results: statuses });
  fireEvent.click(screen.getByRole("button", { name: "Thử lại trạng thái" }));
  await waitFor(() =>
    expect(screen.queryByText(/Không tải được trạng thái/)).toBeNull(),
  );
  await selectOption("Trạng thái", "Hoàn thành");
  expect(listCalls()).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  expect(lastParams().ticket_status_name).toBe("Hoàn thành");
});

it("distinguishes loading, empty results and malformed API data", async () => {
  let finish!: (response: Response) => void;
  listResponse = () =>
    new Promise<Response>((resolve) => {
      finish = resolve;
    });
  renderList();
  expect(screen.getByText("Đang tải yêu cầu...")).toBeTruthy();
  expect(screen.queryByText("Không tìm thấy yêu cầu")).toBeNull();
  await act(async () =>
    finish(Response.json({ ...pagination, count: 0, results: [] })),
  );
  expect(await screen.findByText("Không tìm thấy yêu cầu")).toBeTruthy();
  expect(screen.queryByText("Hiển thị 0–0 trên 0 yêu cầu")).toBeNull();
  expect(
    screen.queryByRole("navigation", { name: "Phân trang yêu cầu" }),
  ).toBeNull();
  expect(
    screen.queryByRole("combobox", { name: "Số yêu cầu mỗi trang" }),
  ).toBeNull();
  listResponse = () => Response.json({ results: null });
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Tìm kiếm yêu cầu" }),
    { target: { value: "laptop" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  expect(
    await screen.findByText(/Dữ liệu danh sách yêu cầu không hợp lệ/),
  ).toBeTruthy();
});

it("does not request ticket data when the account cannot access this page", () => {
  auth.permissions = {};
  renderList();
  expect(screen.getByText("Bạn chưa có quyền truy cập")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: "Tạo yêu cầu" })).toBeNull();
});

it.each([
  { id: "42" },
  { list_name_team_use: [{ id: 1, name: 123 }] },
  { ticket_status_name: { name: "Đang xử lý" } },
])(
  "reports malformed nested ticket data instead of rendering it: %j",
  async (invalid) => {
    listResponse = () =>
      Response.json({
        ...pagination,
        count: 1,
        results: [{ ...ticket, ...invalid }],
      });
    renderList();
    expect(
      await screen.findByText(/Dữ liệu danh sách yêu cầu không hợp lệ/),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  },
);

it("accepts omitted display names when their related entities are absent", async () => {
  const {
    bophansudung_name: _department,
    cancel_user_name: _canceller,
    customer_name: _customer,
    ...withoutNames
  } = ticket;
  listResponse = () =>
    Response.json({
      ...pagination,
      count: 1,
      results: [
        {
          ...withoutNames,
          bophansudung: null,
          cancel_user: null,
          fore_cus: null,
        },
      ],
    });
  renderList();
  await ready();
  const row = screen
    .getByRole("link", { name: ticket.ticket_code })
    .closest("tr")!;
  expect(within(row).getAllByRole("cell")[3].textContent).toBe("—");
});
