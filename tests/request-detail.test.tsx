// @vitest-environment jsdom
import {
  cleanup,
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
          created: "2026-10-20",
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
function open(id = "42") {
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[`/requests/${id}`]}>
          <Routes>
            <Route path="/requests/:ticketID" element={<RequestDetail />} />
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
it("allows processors to update the later section according to field permissions", async () => {
  auth.username = "handler";
  auth.permissions = { is_handling: true };
  await ready();
  tab("Chi tiết yêu cầu");
  const section = screen
    .getByRole("heading", { name: "Phần cập nhật sau" })
    .closest("[data-slot=card]")!;
  expect(
    within(section as HTMLElement).getByRole("button", { name: "Chỉnh sửa" }),
  ).toBeTruthy();
});
it.each([true, undefined])(
  "hides editing for sections visible during creation (editable=%s)",
  async (visibleOnCreate) => {
    Object.assign(ticket.data_item.dataform.header[0], {
      editable: visibleOnCreate,
    });
    auth.permissions = { is_handling: true };
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
  ).toBe(false);
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
