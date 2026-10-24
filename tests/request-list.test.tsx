// @vitest-environment jsdom
import { refreshFailedQueries } from "./fixtures/refresh-failed-queries";
import { expectErrorToast } from "./fixtures/assert-error-toast";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StrictMode } from "react";
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
import { WorkspaceRoute } from "./fixtures/workspace-route";
import {
  requestStatusFixtures,
  requestTicketFixture,
  requestTypeFixtures,
} from "./fixtures/requests";

const fetchMock = vi.fn<typeof fetch>();
const ticket = requestTicketFixture;
const statuses = requestStatusFixtures;
const pagination = { next: null, previous: null };
let client: QueryClient;
let auth: AuthContextValue;
let listResponse: () => Response | Promise<Response>;
let statusResponse: () => Response | Promise<Response>;
let allResponse: () => Response | Promise<Response>;
let typesResponse: () => Response | Promise<Response>;

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
    permissions: { can_create: true, can_view: true },
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
  allResponse = () =>
    Response.json({
      ...pagination,
      count: 250,
      results: [
        {
          ...ticket,
          id: 84,
          ticket_code: "ALL-0084",
          list_user_received: "IT Support",
        },
      ],
    });
  typesResponse = () => Response.json(requestTypeFixtures);
  fetchMock.mockReset().mockImplementation((input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/list_ticket/")
      return Promise.resolve(listResponse());
    if (url.pathname === "/api/list_ticketstatus/")
      return Promise.resolve(statusResponse());
    if (url.pathname === "/api/list_ticket_all_SupAD/")
      return Promise.resolve(allResponse());
    if (url.pathname === "/api/list_handling_alltickettype/")
      return Promise.resolve(typesResponse());
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
      <button onClick={() => navigate("/requests")}>Open created list</button>
      <button onClick={() => navigate("/requests/all")}>Open all list</button>
      <button onClick={() => navigate("/approvals/pending")}>
        Open pending approvals
      </button>
      <button onClick={() => navigate("/approvals/approved")}>
        Open approved approvals
      </button>
    </>
  );
}

function renderList(path = "/requests", strict = false) {
  const tree = (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <CurrentListPage />
          <LocationControls />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

function CurrentListPage() {
  const location = useLocation();
  const page = workspacePages.find((item) => item.path === location.pathname);
  return <WorkspaceRoute page={page} />;
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

async function ready(label = "Danh sách yêu cầu") {
  await screen.findByRole("table", { name: label });
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

it("loads the ticketV2 list and status endpoints with bearer authentication and renders all columns with row numbers", async () => {
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
  expect(table.getAllByRole("columnheader")).toHaveLength(11);
  expect(table.getAllByRole("columnheader")[0].textContent).toBe("#");
  expect(table.getByRole("cell", { name: "1" })).toBeTruthy();
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
  ).toBe("/requests/42");
  expect(
    screen.getByRole("link", { name: "Tạo yêu cầu" }).getAttribute("href"),
  ).toBe("/requests/new");
  fireEvent.click(table.getByText("Thiết bị"));
  expect(screen.getByTestId("location").textContent).toBe("/requests/42");
});

it("cancels the development StrictMode probe and completes one active request per endpoint without losing the session", async () => {
  renderList("/requests", true);
  await ready();
  await waitFor(() => {
    for (const endpoint of ["/api/list_ticket/", "/api/list_ticketstatus/"]) {
      const calls = fetchMock.mock.calls.filter(
        ([url]) => new URL(String(url)).pathname === endpoint,
      );
      expect(calls).toHaveLength(2);
      expect(calls[0][1]?.signal?.aborted).toBe(true);
      expect(calls[1][1]?.signal?.aborted).toBe(false);
    }
  });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(getCookie(COOKIE_TOKEN_KEY)).toBe("request-access");
});

it("aborts an obsolete search and keeps the latest results when the older response arrives last", async () => {
  renderList();
  await ready();
  let finishOld!: (response: Response) => void;
  listResponse = () =>
    new Promise<Response>((resolve) => {
      finishOld = resolve;
    });
  const input = screen.getByRole("searchbox", { name: "Tìm kiếm yêu cầu" });
  fireEvent.change(input, { target: { value: "old" } });
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() => expect(listCalls()).toHaveLength(2));
  const oldSignal = listCalls()[1][1]?.signal;
  listResponse = () =>
    Response.json({
      ...pagination,
      count: 1,
      results: [{ ...ticket, title: "Latest request" }],
    });
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Tìm kiếm yêu cầu" }),
    { target: { value: "latest" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await ready();
  expect(oldSignal?.aborted).toBe(true);
  expect(
    await screen.findByRole("link", { name: "Latest request" }),
  ).toBeTruthy();
  await act(async () =>
    finishOld(
      Response.json({
        ...pagination,
        count: 1,
        results: [{ ...ticket, title: "Obsolete request" }],
      }),
    ),
  );
  expect(screen.getByRole("link", { name: "Latest request" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Obsolete request" })).toBeNull();
  expect(lastParams().searchAll).toBe("latest");
  expect(getCookie(COOKIE_TOKEN_KEY)).toBe("request-access");
});

it("requests the next page and resets pagination when changing page size", async () => {
  renderList();
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  await waitFor(() => expect(lastParams().page).toBe("2"));
  await ready();
  expect(
    (screen.getByRole("spinbutton", { name: "Đến trang" }) as HTMLInputElement)
      .value,
  ).toBe("2");
  expect(screen.getByText("/ 3")).toBeTruthy();
  expect(
    within(screen.getByRole("table")).getByRole("cell", {
      name: "101",
    }),
  ).toBeTruthy();
  await selectOption("Số yêu cầu mỗi trang", "200 / trang");
  await waitFor(() =>
    expect(lastParams()).toMatchObject({
      page: "1",
      page_size: "200",
      typeView: "create",
    }),
  );
  await ready();
  expect(
    within(screen.getByRole("table")).getByRole("cell", {
      name: "1",
    }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  await waitFor(() => expect(lastParams().page).toBe("2"));
});

it.each(["/requests", "/requests/all"])(
  "returns the existing table to the top on paging and size changes at %s, preserving horizontal scroll and same-page refreshes",
  async (path) => {
    auth.permissions = {
      can_create: true,
      can_view: true,
      can_allticket: true,
    };
    renderList(path);
    const waitReady = path === "/requests" ? ready : allReady;
    const readParams = path === "/requests" ? lastParams : allListParams;
    await waitReady();
    const table = screen.getByRole("table");
    const region = screen.getByRole("region", { name: "Cuộn bảng yêu cầu" });
    region.scrollTop = 400;
    region.scrollLeft = 140;
    let finish!: (response: Response) => void;
    const initialResponse = path === "/requests" ? listResponse : allResponse;
    const pending = () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      });
    if (path === "/requests") listResponse = pending;
    else allResponse = pending;
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(readParams().page).toBe("2"));
    expect(await screen.findByText("Đang cập nhật danh sách...")).toBeTruthy();
    expect(screen.getByRole("table")).toBe(table);
    expect(region.scrollTop).toBe(0);
    expect(region.scrollLeft).toBe(140);
    if (path === "/requests") listResponse = initialResponse;
    else allResponse = initialResponse;
    await act(async () => finish(await initialResponse()));
    await waitReady();
    expect(region.scrollTop).toBe(0);
    region.scrollTop = 300;
    await selectOption("Số yêu cầu mỗi trang", "200 / trang");
    await waitFor(() =>
      expect(readParams()).toMatchObject({ page: "1", page_size: "200" }),
    );
    await waitReady();
    expect(screen.getByRole("table")).toBe(table);
    expect(region.scrollTop).toBe(0);
    expect(region.scrollLeft).toBe(140);
    region.scrollTop = 220;
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["requests"] });
    });
    await waitReady();
    expect(region.scrollTop).toBe(220);
    expect(region.scrollLeft).toBe(140);
  },
);

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
  fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
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
  fireEvent.click(screen.getByRole("button", { name: "Chọn ngày mong muốn" }));
  fireEvent.click(
    await screen.findByRole("button", { name: /ngày 22 tháng 10 năm 2027/ }),
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
    expect(screen.queryByRole("alert")).toBeNull();
    await expectErrorToast(
      /Không tải được yêu cầu: Danh sách tạm thời không khả dụng/,
    );
    expect(screen.queryByText("Không tìm thấy yêu cầu")).toBeNull();
    expect(getCookie(COOKIE_TOKEN_KEY)).toBe("request-access");
    listResponse = () =>
      Response.json({ ...pagination, count: 1, results: [ticket] });
    expect(screen.queryByRole("button", { name: /^Thử lại/ })).toBeNull();
    await refreshFailedQueries(client);
    await ready();
    expect(screen.queryByRole("alert")).toBeNull();
  },
);

it("keeps tickets visible when the status endpoint fails and retries it independently", async () => {
  statusResponse = () =>
    Response.json({ detail: "Status unavailable" }, { status: 500 });
  renderList();
  await ready();
  await expectErrorToast(/Không tải được trạng thái/);
  statusResponse = () =>
    Response.json({ ...pagination, count: statuses.length, results: statuses });
  expect(screen.queryByRole("button", { name: /^Thử lại/ })).toBeNull();
  await refreshFailedQueries(client);
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
  await expectErrorToast(/Dữ liệu danh sách yêu cầu không hợp lệ/);
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
    await expectErrorToast(/Dữ liệu danh sách yêu cầu không hợp lệ/);
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
  expect(within(row).getAllByRole("cell")[4].textContent).toBe("");
});

function allListParams() {
  const calls = fetchMock.mock.calls.filter(
    ([url]) => new URL(String(url)).pathname === "/api/list_ticket_all_SupAD/",
  );
  return Object.fromEntries(
    new URL(String(calls[calls.length - 1][0])).searchParams,
  );
}

async function allReady() {
  await screen.findByRole("table", { name: "Tất cả yêu cầu" });
  await waitFor(() =>
    expect(
      screen
        .getByRole("region", { name: "Kết quả yêu cầu" })
        .getAttribute("aria-busy"),
    ).toBe("false"),
  );
}

it("loads the all-requests endpoint for can_allticket accounts with handler data and no create action", async () => {
  auth.permissions = { can_allticket: true };
  renderList("/requests/all");
  await allReady();
  expect(allListParams()).toEqual({
    page: "1",
    page_size: "100",
    columnSort: "id",
    typeSort: "descend",
  });
  expect(listCalls()).toHaveLength(0);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole("group", { name: "Nhóm yêu cầu" })).toBeNull();
  for (const [, options] of fetchMock.mock.calls) {
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer request-access",
    );
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  }
  const table = within(screen.getByRole("table"));
  expect(
    table.getAllByRole("columnheader").map((header) => header.textContent),
  ).toEqual([
    "#",
    "Mã yêu cầu",
    "Loại yêu cầu",
    "Tiêu đề",
    "Văn phòng",
    "Ngày mong muốn",
    "Người xử lý",
    "Trạng thái",
    "Cập nhật bởi",
  ]);
  expect(table.getByText("IT Support")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Tạo yêu cầu" })).toBeNull();
  fireEvent.click(table.getByText("ALL-0084"));
  expect(screen.getByTestId("location").textContent).toBe("/requests/84");
});

it("preserves bookmarked all-request views when paging or searching and clears them with the filters", async () => {
  auth.permissions = { can_allticket: true };
  renderList("/requests/all?page=2&typeView=received");
  await allReady();
  expect(allListParams()).toMatchObject({ page: "2", typeView: "received" });
  await selectOption("Số yêu cầu mỗi trang", "200 / trang");
  await allReady();
  expect(allListParams()).toMatchObject({
    page: "1",
    page_size: "200",
    typeView: "received",
  });
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  await allReady();
  expect(allListParams().page).toBe("2");
  expect(
    within(screen.getByRole("table")).getByRole("cell", { name: "201" }),
  ).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: " laptop " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await allReady();
  expect(allListParams()).toMatchObject({
    page: "1",
    searchAll: "laptop",
    typeView: "received",
  });
  fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
  await allReady();
  expect(allListParams().typeView).toBeUndefined();
});

it("submits real status and request-type IDs with all-request advanced fields and restores them on Back", async () => {
  auth.permissions = { can_allticket: true };
  renderList("/requests/all?typeView=handle");
  await allReady();
  const before = fetchMock.mock.calls.length;
  await selectOption("Trạng thái", "Hoàn thành");
  expect(fetchMock).toHaveBeenCalledTimes(before);
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await allReady();
  expect(allListParams().ticket_status).toBe("9");
  expect(allListParams().ticket_status_name).toBeUndefined();
  fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
  await screen.findByRole("dialog");
  await selectOption("Loại yêu cầu", "IT - Thiết bị");
  fireEvent.change(screen.getByLabelText("Người xử lý"), {
    target: { value: " Support " },
  });
  fireEvent.change(screen.getByLabelText("Mã yêu cầu"), {
    target: { value: " ALL " },
  });
  fireEvent.change(screen.getByLabelText("Tiêu đề"), {
    target: { value: " Máy tính " },
  });
  fireEvent.change(screen.getByLabelText("Văn phòng"), {
    target: { value: " Đà Nẵng " },
  });
  fireEvent.change(screen.getByLabelText("Cập nhật bởi"), {
    target: { value: " Bình " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
  await waitFor(() =>
    expect(allListParams()).toMatchObject({
      ticket_type_id: "17",
      list_user_received: "Support",
      ticket_code: "ALL",
      title: "Máy tính",
      vanphong_name: "Đà Nẵng",
      updating_user_name: "Bình",
      ticket_status: "9",
      typeView: "handle",
      page: "1",
    }),
  );
  await allReady();
  expect(screen.getByRole("button", { name: "Lọc nâng cao" }).textContent).toBe(
    "6",
  );
  fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
  await allReady();
  expect(allListParams()).toEqual({
    page: "1",
    page_size: "100",
    columnSort: "id",
    typeSort: "descend",
  });
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  await allReady();
  expect(allListParams().typeView).toBe("handle");
  expect(
    screen.getByRole("combobox", { name: "Trạng thái" }).textContent,
  ).toContain("Hoàn thành");
  fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
  await screen.findByRole("dialog");
  expect(
    screen.getByRole("combobox", { name: "Loại yêu cầu" }).textContent,
  ).toContain("IT - Thiết bị");
  expect((screen.getByLabelText("Người xử lý") as HTMLInputElement).value).toBe(
    "Support",
  );
});

it("isolates personal and all-request query data while navigating between lists", async () => {
  auth.permissions = { can_create: true, can_view: true, can_allticket: true };
  renderList();
  await ready();
  let finish!: (response: Response) => void;
  allResponse = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  fireEvent.click(screen.getByRole("button", { name: "Open all list" }));
  await screen.findByText("Đang tải yêu cầu...");
  expect(screen.queryByText("RS-0042")).toBeNull();
  expect(screen.queryByRole("table")).toBeNull();
  await act(async () =>
    finish(
      Response.json({
        ...pagination,
        count: 1,
        results: [{ ...ticket, ticket_code: "ALL-NEW" }],
      }),
    ),
  );
  await allReady();
  expect(screen.getByText("ALL-NEW")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Open created list" }));
  await ready();
  expect(screen.getByText("RS-0042")).toBeTruthy();
  expect(screen.queryByText("ALL-NEW")).toBeNull();
  expect(lastParams().typeView).toBe("create");
});

it("rejects unsafe or personal-only URL filters on the all-request page", async () => {
  auth.permissions = { can_allticket: true };
  renderList(
    "/requests/all?page=-1&page_size=500&typeView=create&ticket_status=NaN&ticket_type_id=Thiết%20bị&ticket_type_name=test&approve_user_name=admin&columnSort=title&typeSort=ascend",
  );
  await allReady();
  expect(allListParams()).toEqual({
    page: "1",
    page_size: "100",
    columnSort: "id",
    typeSort: "descend",
  });
});

it("denies the all-request page without can_allticket and does not fetch its options or records", () => {
  renderList("/requests/all");
  expect(screen.getByText("Bạn chưa có quyền truy cập")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("keeps all-request records available when request-type options fail and retries independently", async () => {
  auth.permissions = { can_allticket: true };
  typesResponse = () =>
    Response.json([{ ...requestTypeFixtures[0], id: "17" }]);
  renderList("/requests/all?ticket_type_id=17");
  await allReady();
  await expectErrorToast(/Dữ liệu loại yêu cầu không hợp lệ/);
  expect(screen.getByText("ALL-0084")).toBeTruthy();
  typesResponse = () => Response.json(requestTypeFixtures);
  expect(screen.queryByRole("button", { name: /^Thử lại/ })).toBeNull();
  await refreshFailedQueries(client);
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(allListParams().ticket_type_id).toBe("17");
  fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
  await screen.findByRole("dialog");
  expect(
    screen.getByRole("combobox", { name: "Loại yêu cầu" }).textContent,
  ).toContain("IT - Thiết bị");
});

it("searches request types without accents, applies only on submit and keeps the drawer open on Escape", async () => {
  auth.permissions = { can_allticket: true };
  typesResponse = () =>
    Response.json([
      ...requestTypeFixtures,
      {
        ...requestTypeFixtures[0],
        id: 18,
        name: "Nghỉ phép",
        handling_group_name: "HR",
      },
    ]);
  renderList("/requests/all?page=2");
  await allReady();
  fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
  const drawer = await screen.findByRole("dialog", { name: "Lọc nâng cao" });
  const trigger = screen.getByRole("combobox", { name: "Loại yêu cầu" });
  fireEvent.click(trigger);
  let search = await screen.findByRole("combobox", {
    name: "Tìm loại yêu cầu",
  });
  const before = fetchMock.mock.calls.length;
  fireEvent.change(search, { target: { value: " THIET BI " } });
  expect(
    await screen.findByRole("option", { name: "IT - Thiết bị" }),
  ).toBeTruthy();
  await waitFor(() =>
    expect(screen.queryByRole("option", { name: "HR - Nghỉ phép" })).toBeNull(),
  );
  fireEvent.keyDown(search, { key: "ArrowDown", code: "ArrowDown" });
  await waitFor(() =>
    expect(search.getAttribute("aria-activedescendant")).toBeTruthy(),
  );
  fireEvent.keyDown(search, { key: "Enter", code: "Enter" });
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  expect(trigger.textContent).toContain("IT - Thiết bị");
  expect(fetchMock).toHaveBeenCalledTimes(before);
  expect(screen.getByRole("dialog", { name: "Lọc nâng cao" })).toBe(drawer);
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
  await waitFor(() =>
    expect(allListParams()).toMatchObject({ page: "1", ticket_type_id: "17" }),
  );
  await allReady();
  fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
  await screen.findByRole("dialog", { name: "Lọc nâng cao" });
  fireEvent.click(screen.getByRole("combobox", { name: "Loại yêu cầu" }));
  search = await screen.findByRole("combobox", { name: "Tìm loại yêu cầu" });
  expect((search as HTMLInputElement).value).toBe("");
  fireEvent.change(search, { target: { value: "not-a-real-type" } });
  expect(await screen.findByText("Không tìm thấy kết quả.")).toBeTruthy();
  fireEvent.keyDown(search, { key: "Escape", code: "Escape" });
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  expect(screen.getByRole("dialog", { name: "Lọc nâng cao" })).toBeTruthy();
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("combobox", { name: "Loại yêu cầu" }),
    ),
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Loại yêu cầu" }));
  search = await screen.findByRole("combobox", { name: "Tìm loại yêu cầu" });
  fireEvent.change(search, { target: { value: "hr" } });
  expect(
    await screen.findByRole("option", { name: "HR - Nghỉ phép" }),
  ).toBeTruthy();
  await waitFor(() =>
    expect(screen.queryByRole("option", { name: "IT - Thiết bị" })).toBeNull(),
  );
  fireEvent.change(search, { target: { value: "" } });
  fireEvent.click(
    await screen.findByRole("option", { name: "Tất cả loại yêu cầu" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
  await waitFor(() => expect(allListParams().ticket_type_id).toBeUndefined());
});

it("rejects malformed all-request handler data and hides pagination for empty results", async () => {
  auth.permissions = { can_allticket: true };
  allResponse = () =>
    Response.json({
      ...pagination,
      count: 1,
      results: [{ ...ticket, list_user_received: [] }],
    });
  renderList("/requests/all");
  await expectErrorToast(/Dữ liệu danh sách yêu cầu không hợp lệ/);
  allResponse = () => Response.json({ ...pagination, count: 0, results: [] });
  expect(screen.queryByRole("button", { name: /^Thử lại/ })).toBeNull();
  await refreshFailedQueries(client);
  expect(await screen.findByText("Không tìm thấy yêu cầu")).toBeTruthy();
  expect(
    screen.queryByRole("navigation", { name: "Phân trang yêu cầu" }),
  ).toBeNull();
});

const approvalPages = [
  {
    path: "/approvals/pending",
    label: "Chờ phê duyệt",
    typeView: "pendingAccept",
  },
  {
    path: "/approvals/approved",
    label: "Đã phê duyệt",
    typeView: "accepted",
  },
] as const;

it.each(approvalPages)(
  "loads $label with the fixed V2 view, requester columns and authenticated requests",
  async ({ path, label, typeView }) => {
    auth.permissions = { can_accept: true };
    statusResponse = () =>
      Response.json({
        ...pagination,
        count: statuses.length + 1,
        results: [
          { ...statuses[0], id: 1, name: "Trạng thái ban đầu" },
          ...statuses,
        ],
      });
    renderList(
      `${path}?page=2&typeView=received&approve_user_name=wrong&list_user_received=wrong&ticket_status=9&ticket_type_id=17&columnSort=title&typeSort=ascend`,
    );
    await ready(label);
    expect(lastParams()).toEqual({
      page: "2",
      page_size: "100",
      columnSort: "id",
      typeSort: "descend",
      typeView,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options?.method).toBe("GET");
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      expect(new Headers(options?.headers).get("Authorization")).toBe(
        "Bearer request-access",
      );
    }
    const table = within(screen.getByRole("table", { name: label }));
    expect(
      table.getAllByRole("columnheader").map((cell) => cell.textContent),
    ).toEqual([
      "#",
      "Mã yêu cầu",
      "Loại yêu cầu",
      "Tiêu đề",
      "Văn phòng",
      "Ngày mong muốn",
      "Người yêu cầu",
      "Trạng thái",
      "Cập nhật bởi",
    ]);
    expect(table.getByRole("cell", { name: "101" })).toBeTruthy();
    expect(table.getByText(ticket.username_create)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Tạo yêu cầu" })).toBeNull();
    fireEvent.click(screen.getByRole("combobox", { name: "Trạng thái" }));
    expect(
      await screen.findByRole("option", { name: "Hoàn thành" }),
    ).toBeTruthy();
    expect(
      Boolean(screen.queryByRole("option", { name: "Trạng thái ban đầu" })),
    ).toBe(typeView === "pendingAccept");
    const completed = screen.getByRole("option", { name: "Hoàn thành" });
    fireEvent.pointerDown(completed, { pointerType: "mouse" });
    fireEvent.click(completed);
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    fireEvent.click(table.getByText("Thiết bị"));
    expect(screen.getByTestId("location").textContent).toBe("/requests/42");
  },
);

it.each(approvalPages)(
  "applies draft search/status and requester filters to $label, preserving the view on clear and Back",
  async ({ path, label, typeView }) => {
    auth.permissions = { can_accept: true };
    renderList(`${path}?page=2`);
    await ready(label);
    await selectOption("Trạng thái", "Hoàn thành");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "  Máy & VPN  " },
    });
    expect(listCalls()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    await ready(label);
    expect(lastParams()).toMatchObject({
      typeView,
      page: "1",
      searchAll: "Máy & VPN",
      ticket_status_name: "Hoàn thành",
    });
    fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
    const fields = {
      "Mã yêu cầu": " RS-0042 ",
      "Loại yêu cầu": " Thiết bị ",
      "Tiêu đề": " máy mới ",
      "Văn phòng": " Đà Nẵng ",
      "Ngày mong muốn": "21/10/2026",
      "Người yêu cầu": " Requester ",
      "Cập nhật bởi": " Trần Bình ",
    };
    expect(screen.queryByLabelText("Người phê duyệt")).toBeNull();
    for (const [name, value] of Object.entries(fields))
      fireEvent.change(screen.getByLabelText(name), { target: { value } });
    expect(listCalls()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    await waitFor(() => expect(lastParams().username_create).toBe("Requester"));
    await ready(label);
    expect(lastParams()).toMatchObject({
      typeView,
      page: "1",
      ticket_code: "RS-0042",
      ticket_type_name: "Thiết bị",
      title: "máy mới",
      vanphong_name: "Đà Nẵng",
      duedate: "2026-10-21",
      username_create: "Requester",
      updating_user_name: "Trần Bình",
      ticket_status_name: "Hoàn thành",
    });
    expect(lastParams().approve_user_name).toBeUndefined();
    expect(
      screen.getByRole("button", { name: "Lọc nâng cao" }).textContent,
    ).toBe("7");
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    await ready(label);
    expect(lastParams()).toEqual({
      typeView,
      page: "1",
      page_size: "100",
      columnSort: "id",
      typeSort: "descend",
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await ready(label);
    fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
    expect(
      (screen.getByLabelText("Người yêu cầu") as HTMLInputElement).value,
    ).toBe("Requester");
    expect(screen.getByTestId("location").textContent).toContain(
      "username_create=Requester",
    );
  },
);

it.each(approvalPages)(
  "keeps $label rows under the loading overlay and resets only vertical scroll when paging",
  async ({ path, label, typeView }) => {
    auth.permissions = { can_accept: true };
    renderList(path);
    await ready(label);
    const table = screen.getByRole("table");
    const scroll = screen.getByRole("region", { name: "Cuộn bảng yêu cầu" });
    scroll.scrollTop = 400;
    scroll.scrollLeft = 180;
    let finish!: (response: Response) => void;
    listResponse = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(await screen.findByText("Đang cập nhật danh sách...")).toBeTruthy();
    expect(screen.getByRole("table")).toBe(table);
    expect(scroll.scrollTop).toBe(0);
    expect(scroll.scrollLeft).toBe(180);
    expect(lastParams()).toMatchObject({ page: "2", typeView });
    await act(async () =>
      finish(Response.json({ ...pagination, count: 250, results: [ticket] })),
    );
    await ready(label);
    expect(within(table).getByRole("cell", { name: "101" })).toBeTruthy();
    listResponse = () =>
      Response.json({ ...pagination, count: 250, results: [ticket] });
    await selectOption("Số yêu cầu mỗi trang", "200 / trang");
    await ready(label);
    expect(lastParams()).toMatchObject({
      page: "1",
      page_size: "200",
      typeView,
    });
  },
);

it.each(approvalPages)(
  "handles errors, malformed requesters and empty data on $label without losing the session",
  async ({ path, label }) => {
    auth.permissions = { can_accept: true };
    listResponse = () =>
      Response.json({ detail: "Không thể tải phê duyệt" }, { status: 403 });
    renderList(path);
    await expectErrorToast(/Không tải được yêu cầu: Không thể tải phê duyệt/);
    expect(getCookie(COOKIE_TOKEN_KEY)).toBe("request-access");
    listResponse = () =>
      Response.json({
        ...pagination,
        count: 1,
        results: [{ ...ticket, username_create: [] }],
      });
    expect(screen.queryByRole("button", { name: /^Thử lại/ })).toBeNull();
    await refreshFailedQueries(client);
    await expectErrorToast(/Dữ liệu danh sách yêu cầu không hợp lệ/);
    listResponse = () =>
      Response.json({ ...pagination, count: 0, results: [] });
    expect(screen.queryByRole("button", { name: /^Thử lại/ })).toBeNull();
    await refreshFailedQueries(client);
    expect(await screen.findByText("Không tìm thấy yêu cầu")).toBeTruthy();
    expect(
      screen.queryByRole("navigation", { name: "Phân trang yêu cầu" }),
    ).toBeNull();
    expect(screen.queryByRole("table", { name: label })).toBeNull();
  },
);

it.each(approvalPages)(
  "does not fetch $label without can_accept, even with create or all-request permissions",
  ({ path }) => {
    auth.permissions = {
      can_create: true,
      can_view: true,
      can_allticket: true,
    };
    renderList(path);
    expect(screen.getByText("Bạn chưa có quyền truy cập")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it("isolates pending, approved and personal caches while switching lists with explicit page permissions", async () => {
  auth.permissions = { can_view: true, can_accept: true, can_allticket: true };
  listResponse = () =>
    Response.json({
      ...pagination,
      count: 1,
      results: [{ ...ticket, ticket_code: "PENDING-42" }],
    });
  renderList("/approvals/pending");
  await ready("Chờ phê duyệt");
  let finish!: (response: Response) => void;
  listResponse = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  fireEvent.click(
    screen.getByRole("button", { name: "Open approved approvals" }),
  );
  expect(await screen.findByText("Đang tải yêu cầu...")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "PENDING-42" })).toBeNull();
  await waitFor(() => expect(lastParams().typeView).toBe("accepted"));
  await act(async () =>
    finish(
      Response.json({
        ...pagination,
        count: 1,
        results: [{ ...ticket, ticket_code: "APPROVED-42" }],
      }),
    ),
  );
  await ready("Đã phê duyệt");
  expect(screen.getByRole("link", { name: "APPROVED-42" })).toBeTruthy();
  listResponse = () =>
    Response.json({
      ...pagination,
      count: 1,
      results: [{ ...ticket, ticket_code: "CREATED-42" }],
    });
  fireEvent.click(screen.getByRole("button", { name: "Open created list" }));
  await ready();
  expect(lastParams().typeView).toBe("create");
  expect(screen.queryByRole("link", { name: "APPROVED-42" })).toBeNull();
  expect(screen.getByRole("link", { name: "CREATED-42" })).toBeTruthy();
});

it.each([
  {
    path: "/requests",
    label: "Danh sách yêu cầu",
    statusKey: "ticket_status_name",
    statusValue: "Hoàn thành",
  },
  {
    path: "/requests/all",
    label: "Tất cả yêu cầu",
    statusKey: "ticket_status",
    statusValue: "9",
  },
  ...approvalPages.map(({ path, label }) => ({
    path,
    label,
    statusKey: "ticket_status_name",
    statusValue: "Hoàn thành",
  })),
])(
  "searches status options without accents on $label and applies the selected value only on submit",
  async ({ path, label, statusKey, statusValue }) => {
    auth.permissions = {
      can_view: true,
      can_accept: true,
      can_allticket: true,
    };
    renderList(`${path}?page=2`);
    await ready(label);
    const readParams = path === "/requests/all" ? allListParams : lastParams;
    const before = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("combobox", { name: "Trạng thái" }));
    const search = screen.getByRole("combobox", { name: "Tìm trạng thái" });
    fireEvent.change(search, { target: { value: "không có trạng thái này" } });
    expect(await screen.findByText("Không tìm thấy kết quả.")).toBeTruthy();
    fireEvent.change(search, { target: { value: "hOAn tHaNh" } });
    expect(
      await screen.findByRole("option", { name: "Hoàn thành" }),
    ).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Đang xử lý" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Hoàn thành" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(before);
    expect(readParams()[statusKey]).toBeUndefined();
    expect(readParams().page).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    await waitFor(() => expect(readParams()[statusKey]).toBe(statusValue));
    await ready(label);
    expect(readParams().page).toBe("1");
    expect(
      screen
        .getByRole("combobox", { name: "Trạng thái" })
        .getAttribute("title"),
    ).toBe("Hoàn thành");
  },
);

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
