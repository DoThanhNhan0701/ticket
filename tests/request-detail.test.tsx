// @vitest-environment jsdom
import { templateCombinations } from "./fixtures/template-combinations";
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
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/context/auth-context";
import { RequestDetail } from "@/features/requests/components/request-detail";
import { requestDetailSchema } from "@/features/requests/schemas/request-detail-schema";
import {
  canEditTicketField,
  ticketFieldRoles,
  ticketDetailRows,
  sectionUpdateRows,
  ticketFileUrl,
} from "@/features/requests/utils/ticket-detail";
import {
  getRequestDetail,
  validTicketId,
} from "@/features/requests/api/request-detail-api";
import { setCookie } from "@/lib/cookies";
import { clearAuthSession } from "@/lib/auth-session";
import { COOKIE_TOKEN_KEY } from "@/constants/auth";
import { requestDetailFixture } from "./fixtures/request-detail";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
let client: QueryClient;
let ticket: typeof requestDetailFixture;
let auth: AuthContextValue;
let failure: number;
let saveFailure: boolean;
const fetchMock = vi.fn<typeof fetch>();
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  clearAuthSession();
  setCookie(COOKIE_TOKEN_KEY, "detail-access");
  ticket = structuredClone(requestDetailFixture);
  failure = 0;
  saveFailure = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  auth = {
    token: "access",
    username: "ticket-user",
    userId: 1,
    permissions: { can_create: true },
    avatarUrl: null,
    userPermission: null,
    isInitializing: false,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    setError: vi.fn(),
    refreshUserPermission: vi.fn(),
  };
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/ticket_manager/42")
      return failure
        ? json({ detail: "Server unavailable" }, failure)
        : json(ticket);
    if (url.pathname === "/api/list_ticket_history/")
      return json([
        {
          id: 1,
          username: "handler",
          created: "2026-10-20T18:04:05Z",
          system_log: "Đã tiếp nhận",
          user_log: "",
          comment_content: "",
        },
      ]);
    if (url.pathname === "/api/edit_item_data/") {
      if (saveFailure) return json({ error: "Không lưu được biểu mẫu" });
      const body = JSON.parse(String(options?.body));
      Object.assign(
        ticket.data_item.dataform.data[0],
        body.formDataTicket.dataform.data[0],
      );
      return json({ message: "OK" });
    }
    if (url.pathname === "/api/ticket_comment") return json({ message: "OK" });
    throw new Error(`Unexpected endpoint: ${url.pathname}`);
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  clearAuthSession();
});
function CurrentLocation() {
  const { pathname, search, hash } = useLocation();
  return (
    <output data-testid="detail-location">
      {pathname}
      {search}
      {hash}
    </output>
  );
}
function open(id = "42", previous?: string) {
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter
          initialEntries={[...(previous ? [previous] : []), `/requests/${id}`]}
        >
          <Routes>
            <Route path="/requests/:ticketID" element={<RequestDetail />} />
            <Route path="*" element={<p>Trang trước</p>} />
          </Routes>
          <CurrentLocation />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
async function ready() {
  open();
  await screen.findByText("RS-0042");
}

it("leaves missing general fields, dates and detail cells blank", async () => {
  ticket.bophansudung_name = "";
  ticket.approve_date = "";
  ticket.list_user_received = [];
  ticket.list_name_team_use = [];
  ticket.description = "";
  ticket.data_item.dataform.data[0]["old-key"] = "";
  await ready();
  for (const label of [
    "Department",
    "Team sử dụng",
    "Ngày phê duyệt",
    "Người xử lý",
    "Ghi chú",
  ]) {
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
  }
  expect(screen.queryByText("—")).toBeNull();
  tab("Chi tiết yêu cầu");
  await screen.findByRole("heading", { name: "Phần tạo" });
  const section = screen.getByRole("group", { name: "Dữ liệu Phần tạo" });
  expect(within(section).getAllByRole("cell")[1].textContent).toBe("");
  expect(screen.queryByText("—")).toBeNull();
});
function tab(name: string) {
  fireEvent.click(screen.getByRole("tab", { name: new RegExp(name) }));
}
const writes = () =>
  fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");

it.each([
  ["general", "Thông tin chung"],
  ["details", "Chi tiết yêu cầu"],
  ["discussion", "Trao đổi"],
  ["history", "Lịch sử"],
  ["unknown", "Thông tin chung"],
])("restores the selected tab from tab=%s", async (key, label) => {
  open(`42?tab=${key}`);
  await screen.findByText("RS-0042");
  expect(
    screen
      .getByRole("tab", { name: new RegExp(label) })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
});

it("persists the selected tab across remounts while preserving query and hash", async () => {
  open("42?source=email#form");
  await screen.findByText("RS-0042");
  tab("Chi tiết yêu cầu");
  const url = screen.getByTestId("detail-location").textContent!;
  expect(url).toBe("/requests/42?source=email&tab=details#form");
  cleanup();
  open(url.replace("/requests/", ""));
  await screen.findByText("RS-0042");
  expect(
    screen
      .getByRole("tab", { name: "Chi tiết yêu cầu" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.getByRole("heading", { name: "Phần tạo" })).toBeTruthy();
});

it("shows only the selected create-style step and keeps all template sections", async () => {
  await ready();
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Loại yêu cầu" })).toBeTruthy();
  expect(screen.getAllByRole("tab")).toHaveLength(4);
  expect(
    screen.queryByRole("tab", {
      name: /Loại yêu cầu|Thông tin bổ sung|Thông tin yêu cầu/,
    }),
  ).toBeNull();
  const panel = within(screen.getByRole("tabpanel"));
  expect(
    (panel.getByLabelText("Bộ phận xử lý") as HTMLInputElement).readOnly,
  ).toBe(true);
  expect(panel.getByLabelText("Ngày mong muốn")).toBeTruthy();
  expect((panel.getByLabelText("Ghi chú") as HTMLTextAreaElement).rows).toBe(3);
  expect(
    panel.getByRole("heading", { name: "Thông tin yêu cầu" }),
  ).toBeTruthy();
  expect(
    panel.getByRole("heading", { name: "Thông tin bổ sung" }),
  ).toBeTruthy();
  expect(panel.getByRole("link", { name: "report.pdf" })).toBeTruthy();
  tab("Thông tin chung");
  expect(
    within(screen.getByRole("tabpanel")).getByDisplayValue("handler"),
  ).toBeTruthy();
  tab("Chi tiết yêu cầu");
  expect(screen.getByRole("heading", { name: "Phần tạo" })).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Phần cập nhật sau" }),
  ).toBeTruthy();
  expect(screen.getByText("Dữ liệu đã lưu")).toBeTruthy();
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  expect(writes()).toHaveLength(0);
});
it("supports keyboard tab navigation and lazy-loads history", async () => {
  await ready();
  expect(
    fetchMock.mock.calls.some(([url]) =>
      String(url).includes("list_ticket_history"),
    ),
  ).toBe(false);
  fireEvent.keyDown(screen.getByRole("tab", { name: /Thông tin chung/ }), {
    key: "End",
  });
  expect(await screen.findByText("Đã tiếp nhận")).toBeTruthy();
  expect(screen.getByText("- cập nhật lúc 21/10/2026 01:04:05")).toBeTruthy();
  expect(document.activeElement?.getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
  expect(screen.getByRole("heading", { name: "Loại yêu cầu" })).toBeTruthy();
});
it("allows one section to be edited and preserves draft when switching tabs", async () => {
  ticket.data_item.dataform.header[0].editable = false;
  await ready();
  tab("Chi tiết yêu cầu");
  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
  const field = screen.getByLabelText(/Nội dung/);
  fireEvent.change(field, { target: { value: "Thay đổi nội dung" } });
  tab("Thông tin chung");
  tab("Chi tiết yêu cầu");
  expect((screen.getByLabelText(/Nội dung/) as HTMLInputElement).value).toBe(
    "Thay đổi nội dung",
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).toBeNull(),
  );
  const body = JSON.parse(String(writes()[0][1]?.body));
  expect(body.ticket_id).toBe(42);
  expect(body.formDataTicket.dataform.header).toHaveLength(1);
  expect(body.formDataTicket.dataform.data).toEqual([
    { key: 7, "old-key": "Thay đổi nội dung", "Ngày bắt đầu": "20/10/2026" },
  ]);
});
it("validates only on save and retains values after API failure", async () => {
  ticket.data_item.dataform.header[0].editable = false;
  await ready();
  tab("Chi tiết yêu cầu");
  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
  fireEvent.change(screen.getByLabelText(/Nội dung/), {
    target: { value: "" },
  });
  fireEvent.blur(screen.getByLabelText(/Nội dung/));
  expect(writes()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  expect(await screen.findByText(/Vui lòng nhập/)).toBeTruthy();
  expect(writes()).toHaveLength(0);
  fireEvent.change(screen.getByLabelText(/Nội dung/), {
    target: { value: "Thử lại" },
  });
  saveFailure = true;
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  expect(await screen.findByText("Không lưu được biểu mẫu")).toBeTruthy();
  expect((screen.getByLabelText(/Nội dung/) as HTMLInputElement).value).toBe(
    "Thử lại",
  );
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  expect(screen.queryByLabelText(/Nội dung/)).toBeNull();
});
it.each([1, 4, 5, 7])(
  "does not edit templates in status %s",
  async (status) => {
    ticket.ticket_status = status;
    await ready();
    tab("Chi tiết yêu cầu");
    expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).toBeNull();
  },
);
it("denies editing for a reader who is neither creator nor processor", async () => {
  auth.username = "reader";
  await ready();
  tab("Chi tiết yêu cầu");
  expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).toBeNull();
});
it.each([
  { role: "unassigned staff", status: 3, assignment: null, editable: false },
  {
    role: "completed handler",
    status: 3,
    assignment: "Hoàn thành",
    editable: false,
  },
  {
    role: "active handler",
    status: 3,
    assignment: "Đang xử lý",
    editable: true,
  },
  {
    role: "not yet received",
    status: 2,
    assignment: "Đang xử lý",
    editable: false,
  },
  {
    role: "awaiting reprocess",
    status: 6,
    assignment: "Hoàn thành",
    editable: false,
  },
  {
    role: "completed ticket",
    status: 5,
    assignment: "Đang xử lý",
    editable: false,
  },
  {
    role: "cancelled ticket",
    status: 4,
    assignment: "Đang xử lý",
    editable: false,
  },
  {
    role: "closed ticket",
    status: 7,
    assignment: "Đang xử lý",
    editable: false,
  },
])(
  "limits section editing for $role",
  async ({ status, assignment, editable }) => {
    auth.username = "handler";
    auth.permissions = { is_handling: true };
    ticket.ticket_status = status;
    ticket.list_user_received = assignment
      ? [Object.assign({ username: "handler" }, { status: assignment })]
      : [];
    await ready();
    tab("Chi tiết yêu cầu");
    expect(Boolean(screen.queryByRole("button", { name: "Chỉnh sửa" }))).toBe(
      editable,
    );
    expect(writes()).toHaveLength(0);
  },
);
it("revokes an open editor when the handler is removed on refresh", async () => {
  auth.username = "handler";
  auth.permissions = { is_handling: true };
  ticket.ticket_status = 3;
  Object.assign(ticket.list_user_received[0], { status: "Đang xử lý" });
  await ready();
  tab("Chi tiết yêu cầu");
  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
  const save = screen.getByRole("button", { name: "Lưu thay đổi" });
  await act(async () => {
    client.setQueryData(
      ["request-detail", auth.userId, "42"],
      requestDetailSchema.parse({ ...ticket, list_user_received: [] }),
    );
  });
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).toBeNull(),
  );
  expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).toBeNull();
  fireEvent.click(save);
  expect(writes()).toHaveLength(0);
});
it("does not offer an editor when all processing fields are locked", async () => {
  auth.username = "handler";
  ticket.ticket_status = 3;
  Object.assign(ticket.list_user_received[0], { status: "Đang xử lý" });
  for (const field of ticket.data_item.dataform.header[1].children)
    Object.assign(field, { handling: false });
  await ready();
  tab("Chi tiết yêu cầu");
  expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).toBeNull();
});
it("identifies ticket handlers by ID and only falls back to legacy usernames without an ID", () => {
  const parsed = requestDetailSchema.parse({
    ...ticket,
    ticket_status: 3,
    list_user_received: [
      { user_id: "20", username: "old-name", status: "Đang xử lý" },
    ],
  });
  expect(
    ticketFieldRoles(parsed, { username: "renamed-handler", userId: 20 })
      .editingProcessor,
  ).toBe(true);
  expect(
    ticketFieldRoles(parsed, { username: "old-name", userId: 21 }).processor,
  ).toBe(false);
  expect(
    canEditTicketField(
      { title: "Creator field", type: "text", editable: true },
      { creator: false, processor: false },
    ),
  ).toBe(false);
});
it("preserves server values for fields the actor cannot edit in section payloads", () => {
  const parsed = requestDetailSchema.parse(ticket),
    rows = ticketDetailRows(parsed);
  rows[0].values.f2 = "22/10/2026";
  rows[0].values.f3_start = "01/01/2030";
  expect(
    sectionUpdateRows(
      parsed,
      1,
      rows,
      (field) => field.title === "Ngày kết thúc",
    ),
  ).toEqual([
    {
      key: 7,
      "Ngày kết thúc": "22/10/2026",
      "Khoảng ngày": "20/10/2026 - 22/10/2026",
    },
  ]);
});
it.each([
  { role: "creator", username: "ticket-user", processor: false, visible: true },
  { role: "processor", username: "handler", processor: true, visible: true },
  { role: "reader", username: "reader", processor: false, visible: false },
])(
  "applies restricted field visibility for the $role",
  async ({ username, processor, visible }) => {
    auth.username = username;
    auth.permissions = { is_handling: processor };
    Object.assign(ticket.data_item.dataform.header[0].children[0], {
      status: true,
    });
    await ready();
    tab("Chi tiết yêu cầu");
    expect(Boolean(screen.queryByText("Dữ liệu đã lưu"))).toBe(visible);
    expect(Boolean(screen.queryByRole("button", { name: /^Nội dung$/ }))).toBe(
      visible,
    );
    expect(screen.getByText("20/10/2026")).toBeTruthy();
  },
);
it("hides a section containing only restricted fields from other readers", async () => {
  auth.username = "reader";
  for (const field of ticket.data_item.dataform.header[0].children)
    Object.assign(field, { status: true });
  await ready();
  tab("Chi tiết yêu cầu");
  expect(screen.queryByRole("heading", { name: "Phần tạo" })).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Phần cập nhật sau" }),
  ).toBeTruthy();
});
it.each(templateCombinations)(
  "applies processing edit and required validation independently for $name",
  async (flags) => {
    auth.username = "handler";
    auth.userId = 20;
    auth.permissions = { is_handling: true };
    ticket.ticket_status = 3;
    Object.assign(ticket.list_user_received[0], {
      user_id: 20,
      status: "Đang xử lý",
    });
    ticket.data_item.dataform.header = [
      {
        title: "TEST processing",
        editable: false,
        children: [
          { title: "TEST field", type: "text", editable: true, ...flags },
        ],
      },
    ] as typeof ticket.data_item.dataform.header;
    Object.assign(ticket.data_item.dataform.data[0], { "TEST field": "" });
    await ready();
    tab("Chi tiết yêu cầu");
    expect(Boolean(screen.queryByRole("button", { name: "Chỉnh sửa" }))).toBe(
      flags.handling,
    );
    if (!flags.handling) return;
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    if (flags.required) {
      expect(await screen.findByText("Vui lòng nhập TEST field.")).toBeTruthy();
      expect(writes()).toHaveLength(0);
      fireEvent.change(screen.getByLabelText(/TEST field/), {
        target: { value: "TEST updated" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    }
    await waitFor(() => expect(writes()).toHaveLength(1));
  },
);
it("allows processors to update the later section according to field permissions", async () => {
  auth.username = "handler";
  auth.permissions = { is_handling: true };
  ticket.ticket_status = 3;
  Object.assign(ticket.list_user_received[0], { status: "Đang xử lý" });
  await ready();
  tab("Chi tiết yêu cầu");
  const section = screen
    .getByRole("heading", { name: "Phần cập nhật sau" })
    .closest("[data-slot=card]")!;
  expect(
    within(section as HTMLElement).getByRole("button", { name: "Chỉnh sửa" }),
  ).toBeTruthy();
});
it("locks fields with changes disabled and excludes them from save validation", async () => {
  auth.username = "handler";
  auth.permissions = { is_handling: true };
  ticket.ticket_status = 3;
  Object.assign(ticket.list_user_received[0], { status: "Đang xử lý" });
  Object.assign(ticket.data_item.dataform.header[1].children[1], {
    handling: false,
    required: true,
  });
  ticket.data_item.dataform.data[0]["Khoảng ngày"] = "";
  await ready();
  tab("Chi tiết yêu cầu");
  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
  expect(
    screen.getByLabelText(/Khoảng ngày - Từ ngày/).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen.getByLabelText(/Khoảng ngày - Đến ngày/).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(writes()).toHaveLength(1));
  expect(
    JSON.parse(String(writes()[0][1]?.body)).formDataTicket.dataform.data[0][
      "Khoảng ngày"
    ],
  ).toBe("");
});
it.each([true, undefined])(
  "hides editing for sections visible during creation (editable=%s)",
  async (visibleOnCreate) => {
    Object.assign(ticket.data_item.dataform.header[0], {
      editable: visibleOnCreate,
    });
    auth.permissions = { is_handling: true };
    auth.username = "handler";
    ticket.ticket_status = 3;
    Object.assign(ticket.list_user_received[0], { status: "Đang xử lý" });
    await ready();
    tab("Chi tiết yêu cầu");
    const section = screen
      .getByRole("heading", { name: "Phần tạo" })
      .closest("[data-slot=card]")!;
    expect(
      within(section as HTMLElement).queryByRole("button", {
        name: "Chỉnh sửa",
      }),
    ).toBeNull();
    expect(
      within(section as HTMLElement).getByText("Dữ liệu đã lưu"),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Chỉnh sửa" })).toHaveLength(
      1,
    );
    expect(writes()).toHaveLength(0);
  },
);
it("previews images in a modal and keeps other files as links", async () => {
  await ready();
  tab("Thông tin chung");
  expect(
    screen.getByRole("link", { name: "report.pdf" }).getAttribute("href"),
  ).toBe(`${window.location.origin}/media/report.pdf`);
  fireEvent.click(screen.getByRole("button", { name: "image.png" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("img").getAttribute("src")).toBe(
    `${window.location.origin}/media/image.png`,
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Đóng xem trước ảnh" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("displays replies and posts a trimmed comment without duplicate blank submissions", async () => {
  await ready();
  tab("Trao đổi");
  expect(screen.getByText("Cảm ơn")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Gửi phản hồi" }));
  expect(writes()).toHaveLength(0);
  fireEvent.change(screen.getByLabelText("Phản hồi"), {
    target: { value: "  Phản hồi mới  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Gửi phản hồi" }));
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Phản hồi") as HTMLTextAreaElement).value,
    ).toBe(""),
  );
  const body = writes()[0][1]?.body as FormData;
  expect(body.get("ticket_id")).toBe("42");
  expect(body.get("ticket_comment")).toBe("Phản hồi mới");
});
it.each([
  [404, "Không tìm thấy yêu cầu."],
  [403, "Bạn không có quyền xem yêu cầu này."],
  [500, "Server unavailable"],
])("handles HTTP %s", async (status, message) => {
  failure = Number(status);
  open();
  expect(await screen.findByText(message)).toBeTruthy();
  expect(screen.queryByRole("tab")).toBeNull();
});
it("rejects invalid identifiers without calling the API", async () => {
  open("not-an-id");
  expect(screen.getByText("Mã yêu cầu không hợp lệ.")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(validTicketId("9007199254740992")).toBe(false);
  await expect(getRequestDetail("../42")).rejects.toThrow(
    "Mã yêu cầu không hợp lệ.",
  );
});
it("hides cached ticket controls when access is revoked and can retry loading", async () => {
  await ready();
  failure = 403;
  fireEvent.click(screen.getByRole("button", { name: "Tải lại yêu cầu" }));
  await screen.findByText("Bạn không có quyền xem yêu cầu này.");
  expect(screen.queryByRole("tab")).toBeNull();
  failure = 0;
  fireEvent.click(screen.getByRole("button", { name: "Tải lại yêu cầu" }));
  await screen.findByRole("tab", { name: "Thông tin chung" });
});
it("refreshes recently cached status and actions when reopening a ticket", async () => {
  client.setDefaultOptions({ queries: { retry: false, staleTime: 300_000 } });
  client.setQueryData(
    ["request-detail", 1, "42"],
    requestDetailSchema.parse({
      ...ticket,
      ticket_status_name: "Đã duyệt",
      list_button: { "Tiếp nhận": "#1890ff" },
    }),
  );
  fetchMock.mockResolvedValueOnce(
    json({
      ...ticket,
      ticket_status: 3,
      ticket_status_name: "Đang xử lý",
      list_button: { "Hoàn thành": "#0bb7af" },
    }),
  );
  open();
  await screen.findByRole("button", { name: "Hoàn thành" });
  expect(screen.getByText("Đang xử lý")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Tiếp nhận" })).toBeNull();
  expect(fetchMock).toHaveBeenCalledOnce();
});
it.each(["", null, undefined])(
  "shows tickets without a template when data_item is %s",
  async (dataItem) => {
    fetchMock.mockResolvedValueOnce(json({ ...ticket, data_item: dataItem }));
    await ready();
    tab("Chi tiết yêu cầu");
    expect(
      screen.getByText("Yêu cầu này không có biểu mẫu chi tiết."),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  },
);
it("handles a legacy access-denied response and malformed detail data", async () => {
  fetchMock.mockResolvedValueOnce(json({ message: "You do not have access" }));
  await expect(getRequestDetail("42")).rejects.toMatchObject({ status: 403 });
  fetchMock.mockResolvedValueOnce(json({ id: 42 }));
  await expect(getRequestDetail("42")).rejects.toThrow(
    "Dữ liệu chi tiết yêu cầu không hợp lệ",
  );
});
it("preserves old field identifiers, row keys and date ranges on section updates", () => {
  const parsed = requestDetailSchema.parse(ticket);
  const rows = ticketDetailRows(parsed);
  expect(rows[0].values.f3_start).toBe("20/10/2026");
  expect(sectionUpdateRows(parsed, 1, rows)).toEqual([
    {
      key: 7,
      "Ngày kết thúc": "21/10/2026",
      "Khoảng ngày": "20/10/2026 - 22/10/2026",
    },
  ]);
  expect(ticketFileUrl("javascript:alert(1)")).toBeUndefined();
  expect(ticketFileUrl("//evil.example/file")).toBeUndefined();
  expect(
    canEditTicketField(
      { type: "text", title: "A", editable: true },
      { creator: false, processor: true },
    ),
  ).toBe(true);
});

it.each([true, false])(
  "counts comments and replies on the discussion tab (empty: %s)",
  async (empty) => {
    if (empty) ticket.comments = [];
    await ready();
    const count = empty ? 0 : 2;
    expect(
      screen.getByRole("tab", { name: `Trao đổi ${count} bình luận` }),
    ).toBeTruthy();
  },
);

it.each([5, 18, 20])(
  "runs the special department %s flow through received status 8 before assignment",
  async (group) => {
    const states = {
      2: { name: "Đã duyệt", actions: ["Tiếp nhận", "Hủy"] },
      8: { name: "Đã tiếp nhận", actions: ["Phân công"] },
      3: { name: "Đang xử lý", actions: ["Phân công", "Hủy", "Hoàn thành"] },
      5: { name: "Hoàn thành", actions: ["Đóng"] },
      7: { name: "Đóng", actions: [] },
    };
    let status: keyof typeof states = 2;
    auth.permissions = { can_create: true, is_handling: true };
    fetchMock.mockImplementation(async (input, options) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/ticket_manager/42")
        return json({
          ...ticket,
          handling_group: group,
          ticket_status: status,
          ticket_status_name: states[status].name,
          list_button: Object.fromEntries(
            states[status].actions.map((name) => [name, "#123456"]),
          ),
          list_user_received:
            status === 2 || status === 8
              ? []
              : [
                  {
                    username: "ticket-user",
                    user_id: 1,
                    status: status === 3 ? "Đang xử lý" : "Hoàn thành",
                  },
                ],
          list_user_not_received:
            status === 2 || status === 8 ? { "ticket-user": 1 } : {},
        });
      if (options?.method === "POST") {
        if (path === "/api/receive_ticket/") {
          expect(status).toBe(2);
          status = 8;
        } else if (path === "/api/assignment_ticket/") {
          expect(status).toBe(8);
          expect(JSON.parse(String(options.body)).ls_user_assignment).toEqual([
            1,
          ]);
          status = 3;
        } else if (path === "/api/done_ticket/") {
          expect(status).toBe(3);
          status = 5;
        } else if (path === "/api/close_ticket/") {
          expect(status).toBe(5);
          status = 7;
        } else throw new Error(`Unexpected write ${path}`);
        return json({ status: 200 });
      }
      if (path === "/api/list_ticket_history/") return json([]);
      throw new Error(`Unexpected endpoint ${path}`);
    });
    const confirmAction = async (name: string) => {
      fireEvent.click(screen.getByRole("button", { name }));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    };
    await ready();
    expect(screen.queryByRole("button", { name: "Phân công" })).toBeNull();
    await confirmAction("Tiếp nhận");
    expect(
      within(
        screen.getByRole("group", { name: "Trạng thái yêu cầu" }),
      ).getByText("Đã tiếp nhận"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hoàn thành" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tiếp nhận" })).toBeNull();
    tab("Chi tiết yêu cầu");
    expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Phân công" }));
    fireEvent.click(screen.getByRole("button", { name: "Người nhận xử lý" }));
    fireEvent.click(
      screen.getByRole("button", { name: "ticket-user", pressed: false }),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Phân công",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(
      within(
        screen.getByRole("group", { name: "Trạng thái yêu cầu" }),
      ).getByText("Đang xử lý"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chỉnh sửa" })).toBeTruthy();
    await confirmAction("Hoàn thành");
    expect(screen.queryByRole("button", { name: "Xử lý lại" })).toBeNull();
    await confirmAction("Đóng");
    expect(
      screen.queryByRole("group", { name: "Thao tác yêu cầu" }),
    ).toBeNull();
    expect(writes().map(([url]) => new URL(String(url)).pathname)).toEqual([
      "/api/receive_ticket/",
      "/api/assignment_ticket/",
      "/api/done_ticket/",
      "/api/close_ticket/",
    ]);
  },
);
it.each([5, 18, 20])(
  "revokes the received-ticket assignment dialog after department %s changes manager",
  async (group) => {
    let manager = true;
    fetchMock.mockImplementation(async (input) => {
      if (new URL(String(input)).pathname === "/api/ticket_manager/42")
        return json({
          ...ticket,
          handling_group: group,
          ticket_status: 8,
          ticket_status_name: "Đã tiếp nhận",
          list_button: manager ? { "Phân công": "#123456" } : {},
          list_user_received: [],
        });
      throw new Error(`Unexpected endpoint: ${input}`);
    });
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Phân công" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    manager = false;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["request-detail", 1, "42"] });
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("button", { name: "Phân công" })).toBeNull();
    expect(writes()).toHaveLength(0);
  },
);
it("refreshes status, available actions, and history after a ticket operation", async () => {
  let received = false;
  fetchMock.mockImplementation(async (input, options) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/ticket_manager/42")
      return json({
        ...ticket,
        list_button: received ? {} : { "Tiếp nhận": "#123456" },
        ticket_status_name: received ? "Đang xử lý" : "Chờ tiếp nhận",
      });
    if (path === "/api/receive_ticket/" && options?.method === "POST") {
      received = true;
      return json({ message: "OK" });
    }
    if (path === "/api/list_ticket_history/") return json([]);
    throw new Error(`Unexpected endpoint: ${path}`);
  });
  await ready();
  tab("Lịch sử");
  await screen.findByText("Chưa có lịch sử thay đổi.");
  fireEvent.click(screen.getByRole("button", { name: "Tiếp nhận" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Tiếp nhận",
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByText("Đang xử lý")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Tiếp nhận" })).toBeNull();
  expect(
    screen.getByRole("tab", { name: "Lịch sử" }).getAttribute("aria-selected"),
  ).toBe("true");
  expect(
    fetchMock.mock.calls.filter(
      ([input]) =>
        new URL(String(input)).pathname === "/api/list_ticket_history/",
    ),
  ).toHaveLength(2);
});

it.each([
  "/requests?page=3&searchAll=test#results",
  "/tasks?page=2&ticket_status=3",
  "/requests/pending-approval?page=4",
  "/reports/summary?month=10",
])("returns to the originating page with its filters: %s", async (previous) => {
  vi.spyOn(window.history, "state", "get").mockReturnValue({ idx: 1 });
  open("42", previous);
  await screen.findByText("RS-0042");
  tab("Trao đổi");
  fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
  await waitFor(() =>
    expect(screen.getByTestId("detail-location").textContent).toBe(previous),
  );
});
it.each([null, {}, { idx: 0 }])(
  "falls back to the request list for a directly opened ticket (%j)",
  async (state) => {
    vi.spyOn(window.history, "state", "get").mockReturnValue(state);
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    await waitFor(() =>
      expect(screen.getByTestId("detail-location").textContent).toBe(
        "/requests",
      ),
    );
  },
);
