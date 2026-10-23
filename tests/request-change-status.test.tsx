// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
import { clearAuthSession } from "@/lib/auth-session";
import { getCookie, setCookie } from "@/lib/cookies";
import { WorkspaceRoute } from "./fixtures/workspace-route";
import { changeRequestStatusRequest } from "@/features/requests/api/change-request-status-api";
import { requestStatusFixtures } from "./fixtures/requests";

const fetchMock = vi.fn<typeof fetch>();
const createdKey = ["requests", "created", 42, { page: 1 }];
const allKey = ["requests", "all", 42, { page: 1 }];
let client: QueryClient;
let auth: AuthContextValue;
let statusResponse: () => Response | Promise<Response>;
let changeResponse: () => Response | Promise<Response>;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
  clearAuthSession();
  setCookie(COOKIE_TOKEN_KEY, "change-status-access");
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  auth = {
    token: "change-status-access",
    username: "Operator",
    userId: 42,
    avatarUrl: null,
    permissions: { can_return_ticket: true },
    userPermission: null,
    isInitializing: false,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    setError: vi.fn(),
    refreshUserPermission: vi.fn(),
  };
  statusResponse = () =>
    Response.json({
      count: 3,
      next: null,
      previous: null,
      results: [
        { ...requestStatusFixtures[0], id: 1, name: "Trạng thái ẩn" },
        ...requestStatusFixtures,
      ],
    });
  changeResponse = () =>
    Response.json({ error: "", message: "Cập nhật trạng thái thành công." });
  fetchMock.mockReset().mockImplementation((input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/list_ticketstatus/")
      return Promise.resolve(statusResponse());
    if (path === "/api/change_status_ticket/")
      return Promise.resolve(changeResponse());
    throw new Error(`Unexpected endpoint: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  client.clear();
  clearAuthSession();
});

function renderPage() {
  const page = workspacePages.find(
    (item) => item.path === "/requests/change-status",
  )!;
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[page.path]}>
          <WorkspaceRoute page={page} />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
function posts() {
  return fetchMock.mock.calls.filter(
    ([input]) =>
      new URL(String(input)).pathname === "/api/change_status_ticket/",
  );
}
async function ready() {
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Cập nhật" }).hasAttribute("disabled"),
    ).toBe(false),
  );
}
async function fillForm(reason = " Kiểm tra lại trạng thái ") {
  fireEvent.change(screen.getByLabelText(/Mã yêu cầu/), {
    target: { value: " RS-0042 " },
  });
  fireEvent.click(screen.getByRole("combobox", { name: /Trạng thái/ }));
  const option = await screen.findByRole("option", { name: "Hoàn thành" });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  fireEvent.change(screen.getByLabelText("Lý do"), {
    target: { value: reason },
  });
}

it("loads statuses with bearer authentication for can_return_ticket without fetching any ticket list", async () => {
  renderPage();
  await ready();
  expect(
    screen.getByRole("heading", { name: "Chuyển trạng thái yêu cầu" }),
  ).toBeTruthy();
  expect(screen.queryByText("Trang đang được chuẩn bị")).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [, options] = fetchMock.mock.calls[0];
  expect(options?.method).toBe("GET");
  expect(options?.signal).toBeInstanceOf(AbortSignal);
  expect(new Headers(options?.headers).get("Authorization")).toBe(
    "Bearer change-status-access",
  );
  fireEvent.click(screen.getByRole("combobox", { name: /Trạng thái/ }));
  expect(
    await screen.findByRole("option", { name: "Hoàn thành" }),
  ).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Trạng thái ẩn" })).toBeNull();
  expect(posts()).toHaveLength(0);
});

it("requires a non-whitespace code and a status before submitting", async () => {
  renderPage();
  await ready();
  fireEvent.change(screen.getByLabelText(/Mã yêu cầu/), {
    target: { value: "   " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));
  expect(await screen.findByText("Vui lòng nhập mã yêu cầu.")).toBeTruthy();
  expect(screen.getByText("Vui lòng chọn trạng thái.")).toBeTruthy();
  expect(posts()).toHaveLength(0);
});

it("posts trimmed values and numeric status ID, shows success, and invalidates both cached request lists", async () => {
  client.setQueryData(createdKey, { count: 1, results: [] });
  client.setQueryData(allKey, { count: 1, results: [] });
  renderPage();
  await ready();
  await fillForm(" Kiểm tra lại trạng thái\nGhi chú bổ sung ");
  expect(screen.getByLabelText("Lý do")).toBeInstanceOf(HTMLTextAreaElement);
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));
  expect(
    await screen.findByText("Cập nhật trạng thái thành công."),
  ).toBeTruthy();
  expect(posts()).toHaveLength(1);
  const [, options] = posts()[0];
  expect(options?.method).toBe("POST");
  expect(new Headers(options?.headers).get("Content-Type")).toBe(
    "application/json",
  );
  expect(new Headers(options?.headers).get("Authorization")).toBe(
    "Bearer change-status-access",
  );
  expect(JSON.parse(String(options?.body))).toEqual({
    ticket_code: "RS-0042",
    ticket_status_id: 9,
    lydohuyyeucau: "Kiểm tra lại trạng thái\nGhi chú bổ sung",
  });
  expect(client.getQueryState(createdKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(allKey)?.isInvalidated).toBe(true);
  expect((screen.getByLabelText(/Mã yêu cầu/) as HTMLInputElement).value).toBe(
    " RS-0042 ",
  );
});

it("accepts an omitted reason and prevents duplicate submissions while the update is pending", async () => {
  let finish!: (response: Response) => void;
  changeResponse = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  renderPage();
  await ready();
  await fillForm("");
  const form = screen.getByRole("form", { name: "Chuyển trạng thái yêu cầu" });
  fireEvent.submit(form);
  fireEvent.submit(form);
  await waitFor(() => expect(posts()).toHaveLength(1));
  expect(JSON.parse(String(posts()[0][1]?.body)).lydohuyyeucau).toBe("");
  const saving = screen.getByRole("button", { name: "Đang cập nhật..." });
  expect(saving.hasAttribute("disabled")).toBe(true);
  expect(screen.getByLabelText(/Mã yêu cầu/).hasAttribute("disabled")).toBe(
    true,
  );
  expect(
    screen
      .getByRole("combobox", { name: /Trạng thái/ })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(screen.getByLabelText("Lý do").hasAttribute("disabled")).toBe(true);
  await act(async () =>
    finish(
      Response.json({ error: "", message: "Cập nhật trạng thái thành công." }),
    ),
  );
  expect(
    await screen.findByText("Cập nhật trạng thái thành công."),
  ).toBeTruthy();
  await ready();
});

it("treats an HTTP 200 business error as failure, retains the inputs and permits an explicit retry", async () => {
  client.setQueryData(createdKey, { count: 1, results: [] });
  changeResponse = () =>
    Response.json({ error: "Không tồn tại mã yêu cầu", message: "" });
  renderPage();
  await ready();
  await fillForm();
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Không tồn tại mã yêu cầu",
  );
  expect(client.getQueryState(createdKey)?.isInvalidated).toBe(false);
  expect((screen.getByLabelText(/Mã yêu cầu/) as HTMLInputElement).value).toBe(
    " RS-0042 ",
  );
  expect(getCookie(COOKIE_TOKEN_KEY)).toBe("change-status-access");
  changeResponse = () =>
    Response.json({ error: "", message: "Cập nhật trạng thái thành công." });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));
  expect(
    await screen.findByText("Cập nhật trạng thái thành công."),
  ).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(posts()).toHaveLength(2);
});

it.each([403, 500])(
  "handles HTTP %i errors without clearing the existing session or automatically retrying",
  async (status) => {
    changeResponse = () =>
      Response.json({ detail: "Không thể cập nhật trạng thái." }, { status });
    renderPage();
    await ready();
    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));
    expect(
      await screen.findByText("Không thể cập nhật trạng thái."),
    ).toBeTruthy();
    expect(getCookie(COOKIE_TOKEN_KEY)).toBe("change-status-access");
    expect(posts()).toHaveLength(1);
  },
);

it.each([
  null,
  {},
  { error: false, message: "ok" },
  { error: "", message: 123 },
  { error: "", message: "" },
])("reports malformed change-status responses: %j", async (response) => {
  changeResponse = () => Response.json(response);
  renderPage();
  await ready();
  await fillForm();
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));
  expect(
    await screen.findByText("Dữ liệu chuyển trạng thái không hợp lệ."),
  ).toBeTruthy();
  expect(screen.queryByText("Cập nhật trạng thái thành công.")).toBeNull();
});

it("shows network failures without losing form values", async () => {
  changeResponse = () => Promise.reject(new Error("Network unavailable"));
  renderPage();
  await ready();
  await fillForm();
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));
  expect(await screen.findByText("Network unavailable")).toBeTruthy();
  expect((screen.getByLabelText("Lý do") as HTMLTextAreaElement).value).toBe(
    " Kiểm tra lại trạng thái ",
  );
});

it("blocks submission until status loading finishes and allows retrying failed status loading", async () => {
  let finish!: (response: Response) => void;
  statusResponse = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  renderPage();
  expect(
    screen.getByRole("button", { name: "Cập nhật" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.submit(
    screen.getByRole("form", { name: "Chuyển trạng thái yêu cầu" }),
  );
  expect(posts()).toHaveLength(0);
  await act(async () => finish(Response.json({ results: null })));
  expect(await screen.findByText(/Không tải được trạng thái/)).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Cập nhật" }).hasAttribute("disabled"),
  ).toBe(true);
  statusResponse = () =>
    Response.json({
      count: 2,
      next: null,
      previous: null,
      results: requestStatusFixtures,
    });
  fireEvent.click(screen.getByRole("button", { name: "Thử lại trạng thái" }));
  await ready();
  expect(screen.queryByText(/Không tải được trạng thái/)).toBeNull();
  expect(posts()).toHaveLength(0);
});

it.each([
  { results: [] },
  { results: [{ ...requestStatusFixtures[0], id: 1 }] },
])(
  "blocks updating when no selectable statuses are available",
  async ({ results }) => {
    statusResponse = () =>
      Response.json({
        count: results.length,
        next: null,
        previous: null,
        results,
      });
    renderPage();
    expect(
      await screen.findByText("Không có trạng thái để chuyển."),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Cập nhật" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(posts()).toHaveLength(0);
  },
);

it.each([{}, { can_system: true }, { can_create: true }])(
  "denies unauthorized access without loading data or allowing mutation: %j",
  (permissions) => {
    auth.permissions = permissions;
    renderPage();
    expect(screen.getByText("Bạn chưa có quyền truy cập")).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it("does not allow Django superuser access without can_return_ticket", () => {
  auth.permissions = { is_superuser: true };
  renderPage();
  expect(screen.getByText("Bạn chưa có quyền truy cập")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([0, 1, -1, 1.5])(
  "rejects invalid target status IDs before an API request (%s)",
  async (ticket_status_id) => {
    await expect(
      changeRequestStatusRequest({
        ticket_code: "RS-0042",
        ticket_status_id,
        lydohuyyeucau: "",
      }),
    ).rejects.toThrow("Thông tin chuyển trạng thái không hợp lệ.");
    expect(posts()).toHaveLength(0);
  },
);
