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
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { workspacePages } from "@/app/navigation";
import { WorkspacePage } from "@/pages/workspace";
import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/context/auth-context";
import { clearAuthSession } from "@/lib/auth-session";
import { setCookie, getCookie } from "@/lib/cookies";
import { COOKIE_TOKEN_KEY } from "@/constants/auth";
import { settingsKinds, type SettingsKind } from "@/features/settings/types";
import { settingsConfig } from "@/features/settings/utils/settings-config";
import { listSettingsRequest } from "@/features/settings/api/settings-api";
import { downloadFile } from "@/lib/download";
import {
  settingsFixtures,
  positionPermissionFixture,
  settingsPermissionFixture,
  templateFixture,
} from "./fixtures/settings";

vi.mock("@/lib/download", () => ({ downloadFile: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fetchMock = vi.fn<typeof fetch>();
let client: QueryClient;
let auth: AuthContextValue;
let rows: Record<SettingsKind, object[]>;
let listFailure = "";
let detailFailure = false;
let lookupFailure = false;
let templateExists = true;
let templateFailure = false;
let templateData: unknown;
let writeResponse: (() => Response | Promise<Response>) | null;
const pagination = (results: object[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

beforeEach(() => {
  // jsdom does not provide the PointerEvent constructor used by Base UI Checkbox.
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
  clearAuthSession();
  setCookie(COOKIE_TOKEN_KEY, "settings-access");
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  auth = {
    token: "settings-access",
    username: "test-user",
    userId: 42,
    avatarUrl: null,
    permissions: { can_system: true },
    userPermission: null,
    isInitializing: false,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    setError: vi.fn(),
    refreshUserPermission: vi.fn().mockResolvedValue(null),
  };
  rows = Object.fromEntries(
    settingsKinds.map((kind) => [kind, [settingsFixtures[kind]]]),
  ) as Record<SettingsKind, object[]>;
  listFailure = "";
  detailFailure = false;
  lookupFailure = false;
  templateExists = true;
  templateFailure = false;
  templateData = templateFixture;
  writeResponse = null;
  fetchMock.mockReset().mockImplementation(async (input, options) => {
    const url = new URL(String(input));
    if (options?.method !== "GET") {
      if (writeResponse) return writeResponse();
      if (url.pathname.startsWith("/api/template_form")) {
        templateExists = true;
        templateData = JSON.parse(String(options?.body)).data_form;
        return Response.json({ message: "Template saved successfully" });
      }
      const kind = settingsKinds.find((kind) =>
        url.pathname.startsWith(`/api${settingsConfig[kind].writeEndpoint}`),
      );
      if (!kind) throw new Error(`Unexpected write ${url.pathname}`);
      return Response.json(settingsFixtures[kind]);
    }
    if (url.pathname === "/api/list_position_permission/")
      return lookupFailure
        ? Response.json({ detail: "Lookup offline" }, { status: 500 })
        : Response.json([positionPermissionFixture]);
    if (url.pathname === "/api/list_permission/")
      return Response.json(settingsPermissionFixture);
    if (url.pathname.startsWith("/api/template_form/")) {
      if (templateFailure)
        return Response.json({ detail: "Template offline" }, { status: 500 });
      return Response.json(
        templateExists
          ? templateData
          : { message: "The ticket type template does not exist" },
      );
    }
    const kind = settingsKinds.find(
      (kind) => url.pathname === `/api${settingsConfig[kind].listEndpoint}`,
    );
    if (kind) {
      if (listFailure === kind)
        return Response.json({ detail: "List offline" }, { status: 500 });
      const items = rows[kind];
      if (!settingsConfig[kind].paginated) return Response.json(items);
      const size = Number(url.searchParams.get("page_size") ?? "100"),
        page = Number(url.searchParams.get("page") ?? "1");
      const search = url.searchParams.get("search")?.toLowerCase(),
        status = url.searchParams.get("is_active");
      const filtered = items.filter(
        (item) =>
          (!search || JSON.stringify(item).toLowerCase().includes(search)) &&
          (!status ||
            ("is_active" in item && String(item.is_active) === status)),
      );
      return Response.json({
        ...pagination(filtered),
        results: filtered.slice((page - 1) * size, page * size),
      });
    }
    const detailKind = settingsKinds.find((kind) =>
      url.pathname.startsWith(`/api${settingsConfig[kind].writeEndpoint}`),
    );
    if (detailKind)
      return detailFailure
        ? Response.json({ detail: "Detail offline" }, { status: 500 })
        : Response.json(settingsFixtures[detailKind]);
    throw new Error(`Unexpected endpoint ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  client.clear();
  clearAuthSession();
});
function Location() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function renderPage(kind: SettingsKind, suffix = "") {
  const path = `/settings/${kind}`;
  const page = workspacePages.find((page) => page.path === path)!;
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path + suffix]}>
          <WorkspacePage page={page} />
          <Location />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
function requests(path: string, method = "GET") {
  return fetchMock.mock.calls.filter(
    ([input, options]) =>
      new URL(String(input)).pathname === path && options?.method === method,
  );
}
async function ready() {
  await screen.findByRole("table", { name: "Bảng cấu hình" });
}
async function select(label: string, name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}
async function editorReady(kind: SettingsKind, editing = false) {
  await ready();
  fireEvent.click(
    editing
      ? screen.getByRole("button", {
          name: `Chỉnh sửa ${kind === "users" ? settingsFixtures.users.username : (settingsFixtures[kind] as { name: string }).name}`,
        })
      : screen.getByRole("button", { name: "Thêm mới" }),
  );
  await screen.findByRole("form", {
    name: `${editing ? "Chỉnh sửa" : "Thêm"} ${settingsConfig[kind].label}`,
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
}
function change(label: string, value: string) {
  fireEvent.change(
    screen.getByLabelText(new RegExp(`^${label}(?:\\s*\\*)?$`)),
    {
      target: { value },
    },
  );
}
async function fill(kind: SettingsKind) {
  if (kind === "users") {
    change("Tên đăng nhập", "new-user");
    change("Mã số nhân viên", "RS0099");
    change("Họ", "Nguyễn");
    change("Tên", "An");
    change("Email", "new@example.com");
    await select("Department", "Department AI");
    await select("Team", "Team AI");
    await select("Chức vụ", "Developer");
    await select("Nhóm quyền bổ sung", "Staff");
  } else change(settingsConfig[kind].fields[0].label, "Tên mới");
  if (kind === "teams") await select("Department", "Department AI");
  if (kind === "request-types") await select("Bộ phận xử lý", "ISMS");
  if (kind === "handling-departments") {
    change("Email bộ phận", "new-group@example.com");
    await select("Người quản lý", "test-user · Đỗ Nhân");
    change("Mô tả", "New description");
  }
}

it.each(settingsKinds)(
  "loads typed %s records with shared table and pagination",
  async (kind) => {
    renderPage(kind);
    await ready();
    const listCalls = requests(`/api${settingsConfig[kind].listEndpoint}`);
    expect(listCalls.length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader", { name: "#" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Trang sau" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.queryByText("Trang đang được chuẩn bị")).toBeNull();
    for (const [, options] of fetchMock.mock.calls)
      expect(new Headers(options?.headers).get("Authorization")).toBe(
        "Bearer settings-access",
      );
  },
);
it.each(settingsKinds)("denies %s without sending API requests", (kind) => {
  auth.permissions = { can_create: true };
  renderPage(kind);
  expect(screen.getByText("Bạn chưa có quyền truy cập")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each(settingsKinds)(
  "creates %s with the V2 write contract",
  async (kind) => {
    renderPage(kind);
    await editorReady(kind);
    await fill(kind);
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const writes = requests(
      `/api${settingsConfig[kind].writeEndpoint}`,
      "POST",
    );
    expect(writes).toHaveLength(1);
    const options = writes[0][1]!;
    const body =
      options.body instanceof FormData
        ? Object.fromEntries(options.body.entries())
        : JSON.parse(String(options.body));
    expect(body.is_active).toBe(
      ["users", "request-types", "requesting-departments"].includes(kind)
        ? "true"
        : true,
    );
    if (kind === "users")
      expect(body).toMatchObject({
        username: "new-user",
        msnv: "RS0099",
        bophan: "20",
        team: "11",
        chucvu: "13",
        nhomquyen: "6",
      });
    if (kind === "handling-departments")
      expect(body).toMatchObject({
        is_manager: 42,
        ls_member: [],
        group_email: "new-group@example.com",
        description: "New description",
        is_active: true,
      });
    if (kind === "teams") expect(body.bophan).toBe(20);
    if (kind === "request-types") {
      expect(body.handling_group).toBe("5");
      expect(body).not.toHaveProperty("attachment_file");
    }
    expect(
      requests(`/api${settingsConfig[kind].listEndpoint}`).length,
    ).toBeGreaterThan(1);
  },
);
it.each(settingsKinds)(
  "edits %s, preserving existing relations and closing only after success",
  async (kind) => {
    renderPage(kind);
    await editorReady(kind, true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Kích hoạt" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const write = requests(
      `/api${settingsConfig[kind].writeEndpoint}${settingsFixtures[kind].id}`,
      "PUT",
    );
    expect(write).toHaveLength(1);
    const body = write[0][1]?.body;
    const data =
      body instanceof FormData
        ? Object.fromEntries(body.entries())
        : JSON.parse(String(body));
    expect(data.is_active).toBe(
      ["users", "request-types", "requesting-departments"].includes(kind)
        ? "false"
        : false,
    );
    if (kind === "users") {
      expect(data).toMatchObject({
        is_superuser: "true",
        nhomquyen: "6",
        bophan: "20",
      });
      expect(data).not.toHaveProperty("msnv");
      expect(auth.refreshUserPermission).toHaveBeenCalledOnce();
    }
    if (kind === "positions") expect(data.permission).toEqual([1]);
    if (kind === "handling-departments")
      expect(data).toMatchObject({
        description: "Security group",
        ls_member: [42],
        is_manager: 42,
      });
    if (kind === "request-types") {
      expect(data).not.toHaveProperty("attachment_file");
      expect(requests("/api/template_form/186")).toHaveLength(0);
    }
  },
);

it("enforces the real API's 30-character requesting department name limit before writing", async () => {
  renderPage("requesting-departments");
  await editorReady("requesting-departments");
  const input = screen.getByLabelText(/^Tên bộ phận/);
  expect(input.getAttribute("maxlength")).toBe("30");
  fireEvent.change(input, { target: { value: "A".repeat(31) } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await screen.findByText("Tối đa 30 ký tự.");
  expect(requests("/api/bophanmmanager/", "POST")).toHaveLength(0);
  fireEvent.change(input, { target: { value: "A".repeat(30) } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const body = requests("/api/bophanmmanager/", "POST")[0][1]?.body;
  expect((body as FormData).get("name")).toBe("A".repeat(30));
});
it("paginates array responses, searches accents and clamps an out-of-range page", async () => {
  rows.users = Array.from({ length: 201 }, (_, i) => ({
    ...settingsFixtures.users,
    id: i + 1,
    username: `user-${i}`,
    email: `user${i}@example.com`,
    is_active: i % 2 === 0,
  }));
  renderPage("users", "?page=999");
  await ready();
  await waitFor(() =>
    expect(screen.getByTestId("location").textContent).toContain("page=3"),
  );
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Tìm kiếm người dùng" }),
    { target: { value: "do nhan" } },
  );
  await select("Trạng thái", "Khóa");
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() =>
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      101,
    ),
  );
  expect(screen.getByTestId("location").textContent).toContain(
    "is_active=false",
  );
});
it("passes pagination and applied search to paginated endpoints and hides pagination when empty", async () => {
  renderPage("request-types");
  await ready();
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Tìm kiếm loại yêu cầu" }),
    { target: { value: "unmatched" } },
  );
  expect(requests("/api/list_ticket_type/")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await screen.findByText("Không tìm thấy loại yêu cầu");
  expect(
    screen.queryByRole("navigation", { name: "Phân trang loại yêu cầu" }),
  ).toBeNull();
  const url = new URL(String(requests("/api/list_ticket_type/")[1][0]));
  expect(url.searchParams.get("search")).toBe("unmatched");
  expect(url.searchParams.get("page_size")).toBe("100");
});
it.each([
  "requesting-departments",
  "handling-departments",
  "request-types",
] as const)(
  "filters all %s records by status before pagination when the API ignores is_active",
  async (kind) => {
    rows[kind] = Array.from({ length: 1005 }, (_, index) => ({
      ...settingsFixtures[kind],
      id: index + 1,
      name: `Audit ${index}`,
      is_active: index % 2 === 0,
    }));
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input, options) => {
      const url = new URL(String(input));
      url.searchParams.delete("is_active");
      return original(url, options);
    });
    const controller = new AbortController();
    const data = await listSettingsRequest(
      kind,
      { page: 2, pageSize: 100, search: "Audit", status: "false" },
      controller.signal,
    );
    expect(data.count).toBe(502);
    expect(data.results).toHaveLength(100);
    expect(data.results.every((row) => !row.is_active)).toBe(true);
    expect(data.results[0].id).toBe(202);
    const calls = requests(`/api${settingsConfig[kind].listEndpoint}`);
    expect(calls).toHaveLength(2);
    expect(
      calls.map(([url]) => new URL(String(url)).searchParams.get("page")),
    ).toEqual(["1", "2"]);
    for (const [url, options] of calls) {
      expect(new URL(String(url)).searchParams.get("search")).toBe("Audit");
      expect(options?.signal).toBe(controller.signal);
    }
  },
);
it("preserves server search matches on related fields when filtering status", async () => {
  rows["request-types"] = [
    { ...settingsFixtures["request-types"], is_active: false },
  ];
  const data = await listSettingsRequest("request-types", {
    page: 1,
    pageSize: 100,
    search: "ISMS",
    status: "false",
  });
  expect(data.count).toBe(1);
  expect(data.results[0].id).toBe(settingsFixtures["request-types"].id);
});
it.each(settingsKinds)(
  "clears search and status filters for %s while preserving the page size",
  async (kind) => {
    renderPage(kind, "?search=unmatched&is_active=false&page=2&page_size=200");
    await screen.findByText(`Không tìm thấy ${settingsConfig[kind].label}`);
    const clear = screen.getByRole("button", { name: "Xóa lọc" });
    fireEvent.change(
      screen.getByRole("searchbox", {
        name: `Tìm kiếm ${settingsConfig[kind].label}`,
      }),
      { target: { value: "draft keyword" } },
    );
    fireEvent.click(clear);
    await ready();
    expect(screen.queryByRole("button", { name: "Xóa lọc" })).toBeNull();
    expect(
      (
        screen.getByRole("searchbox", {
          name: `Tìm kiếm ${settingsConfig[kind].label}`,
        }) as HTMLInputElement
      ).value,
    ).toBe("");
    expect(
      screen.getByRole("combobox", { name: "Trạng thái" }).textContent,
    ).toContain("Tất cả trạng thái");
    const location = new URL(
      screen.getByTestId("location").textContent!,
      "http://localhost",
    );
    expect(location.searchParams.get("page")).toBe("1");
    expect(location.searchParams.get("page_size")).toBe("200");
    expect(location.searchParams.has("search")).toBe(false);
    expect(location.searchParams.has("is_active")).toBe(false);
    const latest = requests(`/api${settingsConfig[kind].listEndpoint}`).slice(
      -1,
    )[0];
    const url = new URL(String(latest![0]));
    expect(url.searchParams.has("search")).toBe(false);
    expect(url.searchParams.has("is_active")).toBe(false);
  },
);
it("validates required user fields and email before sending mutations", async () => {
  renderPage("users");
  await editorReady("users");
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(await screen.findByText("Vui lòng nhập tên đăng nhập.")).toBeTruthy();
  await fill("users");
  change("Email", "invalid");
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(await screen.findByText("Email không hợp lệ.")).toBeTruthy();
  expect(requests("/api/usermmanager/", "POST")).toHaveLength(0);
});
it("retains the form after a business error and permits retry", async () => {
  writeResponse = () => Response.json({ error: { name: ["Duplicate"] } });
  renderPage("offices");
  await editorReady("offices");
  await fill("offices");
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await screen.findByText(/Không lưu được dữ liệu/);
  expect(screen.getByRole("dialog")).toBeTruthy();
  writeResponse = null;
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(getCookie(COOKIE_TOKEN_KEY)).toBe("settings-access");
});
it("prevents duplicate writes and dismissal while saving", async () => {
  let finish!: (value: Response) => void;
  writeResponse = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  renderPage("offices");
  await editorReady("offices");
  await fill("offices");
  const form = screen.getByRole("form", { name: "Thêm văn phòng" });
  fireEvent.submit(form);
  fireEvent.submit(form);
  await waitFor(() =>
    expect(requests("/api/vanphongmanager/", "POST")).toHaveLength(1),
  );
  expect(
    screen
      .getByRole("button", { name: "Close dialog" })
      .hasAttribute("disabled"),
  ).toBe(true);
  await act(async () => finish(Response.json(settingsFixtures.offices)));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("retries a list failure without clearing the session", async () => {
  listFailure = "positions";
  renderPage("positions");
  await screen.findByText(/List offline/);
  listFailure = "";
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  await ready();
  expect(getCookie(COOKIE_TOKEN_KEY)).toBe("settings-access");
});
it("blocks saving while a lookup fails and retries independently", async () => {
  lookupFailure = true;
  renderPage("positions");
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Thêm mới" }));
  await screen.findByRole("form", { name: "Thêm chức vụ" });
  const dialog = screen.getByRole("dialog");
  await within(dialog).findByText(/Lookup offline/);
  expect(
    within(dialog)
      .getByRole("button", { name: "Lưu" })
      .hasAttribute("disabled"),
  ).toBe(true);
  lookupFailure = false;
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Thử lại danh mục" }),
  );
  await waitFor(() =>
    expect(
      within(dialog)
        .getByRole("button", { name: "Lưu" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
});
it.each([false, true])(
  "keeps the form mounted beneath an overlay until create/edit data is ready (editing: %s)",
  async (editing) => {
    renderPage("request-types");
    await ready();
    const originalFetch = fetchMock.getMockImplementation()!;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    fetchMock.mockImplementation(async (input, options) => {
      const path = new URL(String(input)).pathname;
      if (
        options?.method === "GET" &&
        ["/api/list_handling_group/", "/api/tickettypemmanager/186"].includes(
          path,
        )
      ) {
        await pending;
        if (path === "/api/tickettypemmanager/186")
          return Response.json({
            ...settingsFixtures["request-types"],
            name: "Tên chi tiết mới",
            is_active: false,
          });
      }
      return originalFetch(input, options);
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: editing ? "Chỉnh sửa Đăng ký từ xa" : "Thêm mới",
      }),
    );
    const form = await screen.findByRole("form", {
      name: `${editing ? "Chỉnh sửa" : "Thêm"} loại yêu cầu`,
    });
    const input = within(form).getByLabelText(/^Tên loại yêu cầu/);
    const loading = screen
      .getByText("Đang tải thông tin...")
      .closest('[role="status"]');
    expect(loading?.classList.contains("absolute")).toBe(true);
    expect(form.parentElement?.getAttribute("aria-busy")).toBe("true");
    expect(input.hasAttribute("disabled")).toBe(true);
    expect(
      within(form)
        .getByRole("button", { name: "Lưu" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      within(form)
        .getByRole("checkbox", { name: "Kích hoạt" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    await act(async () => release());
    await waitFor(() => expect(input.hasAttribute("disabled")).toBe(false));
    expect(screen.queryByText("Đang tải thông tin...")).toBeNull();
    expect(form.parentElement?.getAttribute("aria-busy")).toBe("false");
    expect(screen.getByLabelText(/^Tên loại yêu cầu/)).toBe(input);
    expect((input as HTMLInputElement).value).toBe(
      editing ? "Tên chi tiết mới" : "",
    );
    expect(
      within(form)
        .getByRole("checkbox", { name: "Kích hoạt" })
        .getAttribute("aria-checked"),
    ).toBe(String(!editing));
  },
);
it("keeps the form disabled after failed details and enables it after retry", async () => {
  detailFailure = true;
  renderPage("users");
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa test-user" }));
  await screen.findByText("Detail offline");
  expect(
    screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
  ).toBe(true);
  detailFailure = false;
  fireEvent.click(screen.getByRole("button", { name: "Thử lại thông tin" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
});
it("rejects non-PDF attachments and uploads a valid PDF without deleting the template", async () => {
  renderPage("request-types");
  await editorReady("request-types", true);
  const input = screen.getByLabelText("Tài liệu hướng dẫn (PDF)");
  fireEvent.change(input, {
    target: { files: [new File(["bad"], "bad.txt", { type: "text/plain" })] },
  });
  await screen.findByText("Vui lòng chọn tệp PDF.");
  expect(
    screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.change(input, {
    target: {
      files: [new File(["pdf"], "guide.pdf", { type: "application/pdf" })],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(
    requests("/api/tickettypemmanager/186", "PUT")[0][1]?.body,
  ).toBeInstanceOf(FormData);
  expect(requests("/api/template_form/186", "PUT")).toHaveLength(0);
});
it("edits an existing template while preserving unrecognized fields and validation rules", async () => {
  renderPage("request-types");
  await ready();
  fireEvent.click(
    screen.getByRole("button", { name: "Biểu mẫu Đăng ký từ xa" }),
  );
  await screen.findByRole("form", { name: "Cấu hình biểu mẫu" });
  const section = screen.getByRole("region", { name: "Phần 1" });
  const groupEditable = within(section).getByRole("checkbox", {
    name: "Cho phép chỉnh sửa phần",
  });
  expect(groupEditable.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(groupEditable);
  for (const name of [
    "Bắt buộc",
    "Cho phép thay đổi",
    "Chỉ người tạo và người xử lý",
  ]) {
    fireEvent.click(within(section).getAllByRole("checkbox", { name })[0]);
  }
  fireEvent.change(within(section).getAllByLabelText(/^Tên trường/)[0], {
    target: { value: "Ngày bắt đầu (*)" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu biểu mẫu" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const write = requests("/api/template_form/186", "PUT");
  expect(write).toHaveLength(1);
  const payload = JSON.parse(String(write[0][1]?.body));
  expect(payload).toMatchObject({ ticket_type: 186, user: 42 });
  expect(payload.data_form.forms[0]).toMatchObject({
    editable: false,
    preservedGroupSetting: true,
    colortitle: "#123456",
  });
  expect(payload.data_form.forms[0].children[0]).toMatchObject({
    fixed: "left",
    customSetting: "preserve",
    title: "Ngày bắt đầu",
    required: false,
    handling: true,
    status: true,
  });
  expect(payload.data_form.forms[0].children[1].validate).toEqual({
    operator: ">=",
    target: "Ngày bắt đầu",
  });
});
it("creates a missing template and validates blank or duplicate titles", async () => {
  templateExists = false;
  renderPage("request-types");
  await ready();
  fireEvent.click(
    screen.getByRole("button", { name: "Biểu mẫu Đăng ký từ xa" }),
  );
  await screen.findByRole("form", { name: "Cấu hình biểu mẫu" });
  fireEvent.click(screen.getByRole("button", { name: "Lưu biểu mẫu" }));
  await screen.findByText("Vui lòng thêm ít nhất một phần biểu mẫu.");
  fireEvent.click(screen.getByRole("button", { name: "Thêm phần" }));
  change("Tên phần", "Thông tin");
  fireEvent.click(screen.getByRole("button", { name: "Thêm trường" }));
  change("Tên trường", "Nội dung");
  fireEvent.click(screen.getByRole("button", { name: "Lưu biểu mẫu" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(requests("/api/template_form/", "POST")).toHaveLength(1);
});
it("retries a failed template lookup and cancels without a write", async () => {
  templateFailure = true;
  renderPage("request-types");
  await ready();
  fireEvent.click(
    screen.getByRole("button", { name: "Biểu mẫu Đăng ký từ xa" }),
  );
  await screen.findByText("Template offline");
  templateFailure = false;
  fireEvent.click(screen.getByRole("button", { name: "Thử lại biểu mẫu" }));
  await screen.findByRole("form", { name: "Cấu hình biểu mẫu" });
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(requests("/api/template_form/186", "PUT")).toHaveLength(0);
});
it("exports users through the shared binary client", async () => {
  writeResponse = null;
  const original = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((input, options) =>
    new URL(String(input)).pathname === "/api/export_user"
      ? Promise.resolve(
          new Response("PK Excel", {
            headers: { "Content-Type": "application/vnd.ms-excel" },
          }),
        )
      : original(input, options),
  );
  renderPage("users");
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
  await waitFor(() =>
    expect(downloadFile).toHaveBeenCalledWith(
      expect.any(NodeBlob),
      "Nguoi_dung.xlsx",
    ),
  );
});

it("keeps the template open if the save is not reflected by the server", async () => {
  renderPage("request-types");
  await ready();
  fireEvent.click(
    screen.getByRole("button", { name: "Biểu mẫu Đăng ký từ xa" }),
  );
  await screen.findByRole("form", { name: "Cấu hình biểu mẫu" });
  change("Tên phần", "Changed section");
  writeResponse = () => Response.json({ message: "Save rejected" });
  fireEvent.click(screen.getByRole("button", { name: "Lưu biểu mẫu" }));
  expect(
    await screen.findByText(/Chưa xác nhận được thay đổi biểu mẫu/),
  ).toBeTruthy();
  expect(screen.getByRole("dialog")).toBeTruthy();
});
