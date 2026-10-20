// @vitest-environment jsdom
import { Blob as NodeBlob } from "node:buffer";
import { addDays, format, startOfToday } from "date-fns";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTicketPage } from "@/app/navigation";
import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/context/auth-context";
import { WorkspacePage } from "@/pages/workspace";
import { setCookie } from "@/lib/cookies";
import { clearAuthSession } from "@/lib/auth-session";
import { COOKIE_TOKEN_KEY } from "@/constants/auth";
import { downloadFile } from "@/lib/download";
import { settingsFixtures } from "./fixtures/settings";
import { requestDetailFixture } from "./fixtures/request-detail";
import {
  createMultiSectionTemplate,
  createTemplate,
} from "./fixtures/create-request";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/lib/download", () => ({ downloadFile: vi.fn() }));
const fetchMock = vi.fn<typeof fetch>();
let client: QueryClient;
let auth: AuthContextValue;
let template: unknown;
let handlingGroupName: string;
let lookupFailure: boolean, typeFailure: boolean, templateFailure: boolean;
let createResponse: () => Response | Promise<Response>,
  uploadResponse: () => Response | Promise<Response>;
let importResponse: object;
let pendingImport: Promise<Response> | undefined;
let cloneSource: unknown;
const page = (results: unknown[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});
beforeEach(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
  clearAuthSession();
  setCookie(COOKIE_TOKEN_KEY, "create-access");
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  auth = {
    token: "create-access",
    userId: 42,
    username: "test-user",
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
  template = { forms: createTemplate };
  handlingGroupName = "ISMS";
  lookupFailure = false;
  typeFailure = false;
  templateFailure = false;
  createResponse = () => Response.json({ id: 900, ticket_code: "TEST_900" });
  uploadResponse = () => Response.json({ message: "success" });
  pendingImport = undefined;
  cloneSource = undefined;
  importResponse = {
    message: "success",
    dataform: {
      data: [
        {
          STT: 1,
          "Ghi chú chi tiết": "Excel",
          "Số lượng": 3,
          "Từ ngày": "2026-10-20",
          "Đến ngày": "2026-10-21",
          "Khoảng ngày": "20/10/2026 - 22/10/2026",
          "Phương án": "B",
        },
      ],
    },
  };
  fetchMock.mockReset().mockImplementation(async (input, options) => {
    const url = new URL(String(input)),
      path = url.pathname;
    if (path === "/api/ticket_manager") return createResponse();
    if (path === "/api/ticket_manager/42") return Response.json(cloneSource);
    if (path === "/api/attachmentticketfile") return uploadResponse();
    if (path === "/api/import_excel_ticket_form_data")
      return pendingImport ?? Response.json(importResponse);
    if (path === "/api/export_ticket_type_template")
      return new Response("PK Excel", {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
    expect(options?.method).toBe("GET");
    if (path === "/api/list_customer/")
      return lookupFailure
        ? Response.json({ detail: "Lookup offline" }, { status: 500 })
        : Response.json([{ id: 2, name: "Rainscales VN", is_active: true }]);
    if (path === "/api/list_useraccept/")
      return Response.json([settingsFixtures.users]);
    if (path === "/api/list_handling_group/")
      return Response.json(
        page([
          {
            ...settingsFixtures["handling-departments"],
            name: handlingGroupName,
          },
          { ...settingsFixtures["handling-departments"], id: 6, name: "IT" },
        ]),
      );
    if (path === "/api/list_bophan_sudung/")
      return Response.json(page([settingsFixtures["requesting-departments"]]));
    if (path === "/api/list_team/")
      return Response.json([
        settingsFixtures.teams,
        { ...settingsFixtures.teams, id: 72, name: "Tất cả" },
      ]);
    if (path === "/api/list_vanphong/")
      return Response.json([settingsFixtures.offices]);
    if (path === "/api/list_tickettype/")
      return typeFailure
        ? Response.json({ detail: "Types offline" }, { status: 500 })
        : Response.json(
            page(
              url.searchParams.get("handling_group") === "5"
                ? [
                    settingsFixtures["request-types"],
                    {
                      ...settingsFixtures["request-types"],
                      id: 999,
                      is_active: false,
                    },
                  ]
                : [],
            ),
          );
    if (path.startsWith("/api/template_form/"))
      return templateFailure
        ? Response.json({ detail: "Template offline" }, { status: 500 })
        : Response.json(template);
    throw new Error(`Unexpected endpoint ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  client.clear();
  clearAuthSession();
});
function renderPage(url = "/requests/new") {
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route
              path="/requests/new"
              element={<WorkspacePage page={createTicketPage} />}
            />
            <Route path="/requests" element={<h1>Đã về danh sách</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
const calls = (path: string) =>
  fetchMock.mock.calls.filter(
    ([url]) => new URL(String(url)).pathname === `/api${path}`,
  );
const change = (id: string, value: string) =>
  fireEvent.change(document.getElementById(id)!, { target: { value } });
async function select(label: string, option: string) {
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: label }).hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name: option }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}
async function ready() {
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: "Công ty" }).textContent,
    ).toContain("Rainscales VN"),
  );
}
async function chooseType() {
  await ready();
  await select("Bộ phận xử lý", handlingGroupName);
  await select("Loại yêu cầu", "Đăng ký từ xa");
}
async function fillAssignment() {
  await chooseType();
  await select("Người phê duyệt", "Đỗ Nhân");
}
async function fillBase() {
  await fillAssignment();
  await select("Department", "Department AI");
  await select("Văn phòng", "VP Huế");
  change("create-title", "Yêu cầu TEST");
}
async function fillDetails() {
  await screen.findByRole("group", { name: "Dòng 1" });
  for (const [key, value] of Object.entries({
    f0: "Nội dung mẫu",
    f1: "2",
    f2: "20/10/2026",
    f3: "21/10/2026",
  }))
    change(`detail-0-${key}`, value);
}

async function openCalendar(label: string, index = 0) {
  fireEvent.click(
    screen.getAllByRole("button", { name: `Choose ${label.toLowerCase()}` })[
      index
    ],
  );
  await screen.findByRole("grid");
}
function calendarDay(date: Date) {
  return screen.getByRole("button", {
    name: new RegExp(format(date, "MMMM do, yyyy")),
  }) as HTMLButtonElement;
}

it("reveals each section only after the previous section is complete without submitting", async () => {
  renderPage();
  await ready();
  expect(
    screen.queryByRole("heading", { name: "Thông tin yêu cầu" }),
  ).toBeNull();
  expect(
    screen.queryByRole("heading", { name: /^Chi tiết yêu cầu/ }),
  ).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Thông tin bổ sung" }),
  ).toBeNull();
  fireEvent.submit(screen.getByRole("form", { name: "Tạo yêu cầu mới" }));
  await chooseType();
  expect(
    screen.queryByRole("heading", { name: "Thông tin yêu cầu" }),
  ).toBeNull();
  await select("Người phê duyệt", "Đỗ Nhân");
  expect(
    screen.getByRole("heading", { name: "Thông tin yêu cầu" }),
  ).toBeTruthy();
  await select("Department", "Department AI");
  await select("Văn phòng", "VP Huế");
  change("create-title", "   ");
  expect(screen.queryByRole("group", { name: "Dòng 1" })).toBeNull();
  change("create-title", "Yêu cầu mới");
  expect(await screen.findByRole("group", { name: "Dòng 1" })).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Thông tin bổ sung" }),
  ).toBeNull();
  await fillDetails();
  expect(
    screen.getByRole("heading", { name: "Thông tin bổ sung" }),
  ).toBeTruthy();
  change("detail-0-f3", "19/10/2026");
  expect(
    screen.queryByRole("heading", { name: "Thông tin bổ sung" }),
  ).toBeNull();
  change("detail-0-f3", "21/10/2026");
  expect(
    screen.getByRole("heading", { name: "Thông tin bổ sung" }),
  ).toBeTruthy();
  expect(calls("/ticket_manager")).toHaveLength(0);
});

it("does not show required field errors on focus or blur before Create is clicked", async () => {
  renderPage();
  await ready();
  const group = screen.getByRole("combobox", { name: "Bộ phận xử lý" });
  const approver = screen.getByRole("combobox", { name: "Người phê duyệt" });
  for (const field of [group, approver]) {
    fireEvent.focus(field);
    fireEvent.blur(field);
  }
  expect(screen.queryByText("Vui lòng chọn thông tin.")).toBeNull();
  expect(group.getAttribute("aria-invalid")).toBe("false");
  expect(approver.getAttribute("aria-invalid")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await waitFor(() => expect(group.getAttribute("aria-invalid")).toBe("true"));
  expect(
    screen.getAllByText("Vui lòng chọn thông tin.").length,
  ).toBeGreaterThan(0);
  expect(calls("/ticket_manager")).toHaveLength(0);
});

it("retains later section drafts and attachments while an earlier section is being corrected", async () => {
  renderPage();
  await fillBase();
  await fillDetails();
  change("create-description", "Ghi chú cần giữ");
  fireEvent.change(screen.getByLabelText("Tệp đính kèm"), {
    target: { files: [new File(["draft"], "draft.txt")] },
  });
  change("create-title", "");
  expect(screen.queryByRole("group", { name: "Dòng 1" })).toBeNull();
  expect(screen.queryByLabelText("Ghi chú")).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Tạo yêu cầu" })
      .hasAttribute("disabled"),
  ).toBe(false);
  change("create-title", "Tiêu đề đã sửa");
  expect(
    (document.getElementById("detail-0-f0") as HTMLInputElement).value,
  ).toBe("Nội dung mẫu");
  expect((screen.getByLabelText("Ghi chú") as HTMLTextAreaElement).value).toBe(
    "Ghi chú cần giữ",
  );
  expect(screen.getByRole("button", { name: "Bỏ tệp draft.txt" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Thêm dòng" }));
  expect(screen.queryByLabelText("Ghi chú")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Xóa dòng 2" }));
  expect((screen.getByLabelText("Ghi chú") as HTMLTextAreaElement).value).toBe(
    "Ghi chú cần giữ",
  );
  expect(screen.getByRole("button", { name: "Bỏ tệp draft.txt" })).toBeTruthy();
  expect(calls("/ticket_manager")).toHaveLength(0);
});

it("keeps details hidden for an invalid due date and validates only when Create is clicked", async () => {
  renderPage();
  await fillAssignment();
  change("create-due-date", format(addDays(startOfToday(), -1), "dd/MM/yyyy"));
  await select("Department", "Department AI");
  await select("Văn phòng", "VP Huế");
  change("create-title", "Yêu cầu mới");
  fireEvent.blur(document.getElementById("create-due-date")!);
  expect(
    screen.queryByText("Ngày mong muốn phải hợp lệ và không trước hôm nay."),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByText("Ngày mong muốn phải hợp lệ và không trước hôm nay.");
  expect(calls("/ticket_manager")).toHaveLength(0);
  expect(screen.queryByRole("group", { name: "Dòng 1" })).toBeNull();
  change("create-due-date", format(startOfToday(), "dd/MM/yyyy"));
  fireEvent.blur(document.getElementById("create-due-date")!);
  expect(await screen.findByRole("group", { name: "Dòng 1" })).toBeTruthy();
  expect(
    screen.getByText("Ngày mong muốn phải hợp lệ và không trước hôm nay."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await waitFor(() =>
    expect(
      screen.queryByText("Ngày mong muốn phải hợp lệ và không trước hôm nay."),
    ).toBeNull(),
  );
});

it("returns to the first section and clears the draft when starting over", async () => {
  renderPage();
  await fillBase();
  await fillDetails();
  change("create-description", "Ghi chú cũ");
  fireEvent.click(screen.getByRole("button", { name: "Làm lại" }));
  expect(
    screen.queryByRole("heading", { name: "Thông tin yêu cầu" }),
  ).toBeNull();
  expect(screen.queryByRole("group", { name: "Dòng 1" })).toBeNull();
  expect(screen.queryByLabelText("Ghi chú")).toBeNull();
  await fillBase();
  expect(
    (document.getElementById("detail-0-f0") as HTMLInputElement).value,
  ).toBe("");
  await fillDetails();
  expect((screen.getByLabelText("Ghi chú") as HTMLTextAreaElement).value).toBe(
    "",
  );
});

it("opens the optional section directly when all template fields are optional", async () => {
  const groups = structuredClone(createTemplate);
  for (const group of groups)
    for (const field of group.children) field.required = false;
  groups.push(...structuredClone(createMultiSectionTemplate.slice(1)));
  template = { forms: groups };
  renderPage();
  await fillBase();
  expect(
    await screen.findByRole("heading", { name: "Thông tin bổ sung" }),
  ).toBeTruthy();
  expect(calls("/ticket_manager")).toHaveLength(0);
});

it("shows only sections enabled for creation and preserves hidden sections for later updates", async () => {
  template = { forms: createMultiSectionTemplate };
  renderPage();
  await fillBase();
  await screen.findByRole("group", { name: "Dòng 1" });
  expect(
    screen.getByRole("heading", { name: /^Chi tiết yêu cầu/ }).textContent,
  ).toContain("Nội dung chi tiết");
  expect(screen.queryByText("Phần bộ phận xử lý")).toBeNull();
  expect(screen.queryByText("Phần nghiệm thu")).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Kết quả xử lý" })).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Ngày xử lý" })).toBeNull();
  expect(
    screen.queryByRole("textbox", { name: "Kết quả nghiệm thu" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByText("Vui lòng nhập Ghi chú chi tiết.");
  expect(calls("/ticket_manager")).toHaveLength(0);
  await fillDetails();
  expect(
    screen.getByRole("heading", { name: "Thông tin bổ sung" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Sao chép dòng 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByRole("heading", { name: "Đã về danh sách" });
  const { formDataTicket } = JSON.parse(
    String(calls("/ticket_manager")[0][1]?.body),
  );
  expect(
    formDataTicket.dataform.header.map(
      (group: { title: string }) => group.title,
    ),
  ).toEqual(createMultiSectionTemplate.map((group) => group.title));
  expect(formDataTicket.dataform.original_header).toEqual(
    formDataTicket.dataform.header,
  );
  expect(formDataTicket.dataform.header[1]).toMatchObject({
    editable: false,
    children: [{ required: true }, { required: true }],
  });
  expect(formDataTicket.dataform.header[2]).toMatchObject({ editable: false });
  expect(formDataTicket.dataform.data).toHaveLength(2);
  for (const row of formDataTicket.dataform.data)
    expect(row).toMatchObject({
      "Ghi chú chi tiết": "Nội dung mẫu",
      "Số lượng": "2",
      "Kết quả xử lý": "",
      "Ngày xử lý": "",
      "Kết quả nghiệm thu": "",
    });
});

it("shows an enabled later section instead of a hidden first section and submits it under the correct names", async () => {
  const groups = structuredClone(createMultiSectionTemplate);
  groups[0].editable = false;
  groups[2].editable = true;
  template = { forms: groups };
  renderPage();
  await fillBase();
  await screen.findByRole("textbox", { name: "Kết quả nghiệm thu" });
  expect(
    screen.queryByRole("textbox", { name: "Ghi chú chi tiết" }),
  ).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Kết quả xử lý" })).toBeNull();
  change("detail-0-f0", "Đã nghiệm thu");
  expect(
    screen.getByRole("heading", { name: "Thông tin bổ sung" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByRole("heading", { name: "Đã về danh sách" });
  const { dataform } = JSON.parse(
    String(calls("/ticket_manager")[0][1]?.body),
  ).formDataTicket;
  expect(dataform.header).toHaveLength(3);
  expect(dataform.data[0]).toMatchObject({
    "Ghi chú chi tiết": "",
    "Kết quả xử lý": "",
    "Kết quả nghiệm thu": "Đã nghiệm thu",
  });
});

it("requires all enabled creation sections while ignoring required fields in disabled sections", async () => {
  const groups = structuredClone(createMultiSectionTemplate);
  groups[2].editable = true;
  template = { forms: groups };
  renderPage();
  await fillBase();
  await fillDetails();
  expect(
    screen.getByRole("textbox", { name: "Kết quả nghiệm thu" }),
  ).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "Kết quả xử lý" })).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Thông tin bổ sung" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByText("Vui lòng nhập Kết quả nghiệm thu.");
  expect(calls("/ticket_manager")).toHaveLength(0);
  change("detail-0-f6", "Đã nghiệm thu");
  expect(
    screen.getByRole("heading", { name: "Thông tin bổ sung" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByRole("heading", { name: "Đã về danh sách" });
  const { dataform } = JSON.parse(
    String(calls("/ticket_manager")[0][1]?.body),
  ).formDataTicket;
  expect(dataform.data[0]).toMatchObject({
    "Ghi chú chi tiết": "Nội dung mẫu",
    "Kết quả xử lý": "",
    "Kết quả nghiệm thu": "Đã nghiệm thu",
  });
});

it("allows creation when all detail sections are configured for updates after creation", async () => {
  template = {
    forms: createMultiSectionTemplate.map((group) => ({
      ...group,
      editable: false,
    })),
  };
  renderPage();
  await fillBase();
  await screen.findByText(
    "Các phần chi tiết sẽ được cập nhật sau khi tạo yêu cầu.",
  );
  expect(screen.queryByRole("group", { name: "Dòng 1" })).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Thông tin bổ sung" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByRole("heading", { name: "Đã về danh sách" });
  const { dataform } = JSON.parse(
    String(calls("/ticket_manager")[0][1]?.body),
  ).formDataTicket;
  expect(dataform.header).toHaveLength(3);
  expect(dataform.data[0]).toMatchObject({
    "Ghi chú chi tiết": "",
    "Kết quả xử lý": "",
    "Kết quả nghiệm thu": "",
  });
});

it("loads real endpoint contracts, defaults only the single company and hides inactive types", async () => {
  renderPage();
  await ready();
  expect(
    screen.getByRole("combobox", { name: "Bộ phận xử lý" }).textContent,
  ).toContain("Chọn bộ phận xử lý");
  expect(document.getElementById("create-due-date")).toBeNull();
  await fillBase();
  expect(
    (document.getElementById("create-due-date") as HTMLInputElement).value,
  ).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  expect(await screen.findByRole("group", { name: "Dòng 1" })).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Tài liệu hướng dẫn" })
      .getAttribute("href"),
  ).toBe("https://example.com/guide.pdf");
  expect(calls("/list_tickettype/")[0][0].toString()).toContain(
    "handling_group=5",
  );
});
it("creates the exact legacy payload with multiple detail rows and returns to the list", async () => {
  client.setQueryData(["requests", "created", 42], { count: 0 });
  renderPage();
  await fillBase();
  await fillDetails();
  change("create-description", "Ghi chú TEST");
  fireEvent.click(screen.getByRole("button", { name: "Sao chép dòng 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByRole("heading", { name: "Đã về danh sách" });
  expect(calls("/ticket_manager")).toHaveLength(1);
  const body = JSON.parse(String(calls("/ticket_manager")[0][1]?.body));
  expect(body).toMatchObject({
    handling_group: 5,
    ticket_type: 186,
    approve_user: 42,
    fore_cus: 2,
    bophansudung: 20,
    vanphong: 3,
    other1: "",
    title: "Yêu cầu TEST",
    description: "Ghi chú TEST",
    ticket_status: 1,
  });
  expect(body.duedate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(body.formDataTicket.dataform.data).toEqual([
    {
      key: 1,
      "Ghi chú chi tiết": "Nội dung mẫu",
      "Số lượng": "2",
      "Từ ngày": "20/10/2026",
      "Đến ngày": "21/10/2026",
      "Khoảng ngày": "",
      "Phương án": "",
    },
    {
      key: 2,
      "Ghi chú chi tiết": "Nội dung mẫu",
      "Số lượng": "2",
      "Từ ngày": "20/10/2026",
      "Đến ngày": "21/10/2026",
      "Khoảng ngày": "",
      "Phương án": "",
    },
  ]);
  expect(body.formDataTicket.dataform.header).toEqual(
    body.formDataTicket.dataform.original_header,
  );
  expect(client.getQueryState(["requests", "created", 42])?.isInvalidated).toBe(
    true,
  );
});
it("validates required details and date comparisons before creating anything", async () => {
  renderPage();
  await fillBase();
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByText("Vui lòng nhập Ghi chú chi tiết.");
  expect(document.activeElement?.id).toBe("detail-0-f0");
  expect(calls("/ticket_manager")).toHaveLength(0);
  await fillDetails();
  change("detail-0-f3", "19/10/2026");
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByText("Ngày phải >= Từ ngày.");
  expect(calls("/ticket_manager")).toHaveLength(0);
});
it.each([
  [">", [true, true, false]],
  [">=", [true, false, false]],
  ["<", [false, true, true]],
  ["<=", [false, false, true]],
] as const)(
  "disables calendar dates for the %s template rule",
  async (operator, disabled) => {
    const groups = structuredClone(createTemplate);
    groups[0].children[3].validate = { operator, target: "Từ ngày" };
    template = { forms: groups };
    renderPage();
    await fillBase();
    await fillDetails();
    await openCalendar("Đến ngày");
    for (const [index, day] of [19, 20, 21].entries()) {
      const button = calendarDay(new Date(2026, 9, day));
      expect(button.disabled).toBe(disabled[index]);
      if (button.disabled) {
        fireEvent.click(button);
        expect(
          (document.getElementById("detail-0-f3") as HTMLInputElement).value,
        ).toBe("21/10/2026");
      }
    }
    const allowed =
      operator === ">"
        ? 22
        : [19, 20, 21].find((_, index) => !disabled[index])!;
    fireEvent.click(calendarDay(new Date(2026, 9, allowed)));
    expect(
      (document.getElementById("detail-0-f3") as HTMLInputElement).value,
    ).toBe(`${allowed}/10/2026`);
    const blocked = [19, 20, 21].find((_, index) => disabled[index])!;
    change("detail-0-f3", `${blocked}/10/2026`);
    fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
    await screen.findByText(`Ngày phải ${operator} Từ ngày.`);
    expect(calls("/ticket_manager")).toHaveLength(0);
  },
);
it("updates the open calendar when the reference date changes, clears or is incomplete", async () => {
  renderPage();
  await fillBase();
  await fillDetails();
  await openCalendar("Đến ngày");
  expect(calendarDay(new Date(2026, 9, 21)).disabled).toBe(false);
  change("detail-0-f2", "22/10/2026");
  expect(calendarDay(new Date(2026, 9, 21)).disabled).toBe(true);
  expect(calendarDay(new Date(2026, 9, 22)).disabled).toBe(false);
  for (const value of ["", "22/10/"]) {
    change("detail-0-f2", value);
    expect(calendarDay(new Date(2026, 9, 19)).disabled).toBe(false);
  }
});
it("keeps date constraints independent between copied detail rows", async () => {
  renderPage();
  await fillBase();
  await fillDetails();
  fireEvent.click(screen.getByRole("button", { name: "Sao chép dòng 1" }));
  change("detail-1-f2", "25/10/2026");
  await openCalendar("Đến ngày", 1);
  expect(calendarDay(new Date(2026, 9, 21)).disabled).toBe(true);
  expect(calendarDay(new Date(2026, 9, 25)).disabled).toBe(false);
  fireEvent.keyDown(screen.getByRole("grid"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("grid")).toBeNull());
  await openCalendar("Đến ngày");
  expect(calendarDay(new Date(2026, 9, 21)).disabled).toBe(false);
});
it("disables dates outside both ends of a date range and permits the same day", async () => {
  renderPage();
  await fillBase();
  await fillDetails();
  change("detail-0-f4-start", "20/10/2026");
  change("detail-0-f4-end", "22/10/2026");
  await openCalendar("Khoảng ngày - Từ ngày");
  expect(calendarDay(new Date(2026, 9, 22)).disabled).toBe(false);
  expect(calendarDay(new Date(2026, 9, 23)).disabled).toBe(true);
  fireEvent.keyDown(screen.getByRole("grid"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("grid")).toBeNull());
  await openCalendar("Khoảng ngày - Đến ngày");
  expect(calendarDay(new Date(2026, 9, 19)).disabled).toBe(true);
  expect(calendarDay(new Date(2026, 9, 20)).disabled).toBe(false);
  change("detail-0-f4-start", "21/10/2026");
  expect(calendarDay(new Date(2026, 9, 20)).disabled).toBe(true);
  expect(calendarDay(new Date(2026, 9, 21)).disabled).toBe(false);
});
it("disables past due dates while allowing today and future dates", async () => {
  renderPage();
  await fillAssignment();
  const today = startOfToday();
  change("create-due-date", format(today, "dd/MM/yyyy"));
  await openCalendar("Ngày mong muốn");
  expect(calendarDay(addDays(today, -1)).disabled).toBe(true);
  expect(calendarDay(today).disabled).toBe(false);
  expect(calendarDay(addDays(today, 1)).disabled).toBe(false);
});
it("resets dependent types and rows when the handling group changes", async () => {
  renderPage();
  await fillBase();
  await fillDetails();
  await select("Bộ phận xử lý", "IT");
  await screen.findByText("Bộ phận này chưa có loại yêu cầu đang kích hoạt.");
  expect(screen.queryByRole("group", { name: "Dòng 1" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByText("Vui lòng chọn thông tin.");
  expect(calls("/ticket_manager")).toHaveLength(0);
});
it("allows creation without a template instead of treating it as a lookup error", async () => {
  template = { message: "The ticket type template does not exist" };
  renderPage();
  await fillBase();
  await screen.findByText("Loại yêu cầu này không có biểu mẫu chi tiết.");
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByRole("heading", { name: "Đã về danh sách" });
  expect(
    JSON.parse(String(calls("/ticket_manager")[0][1]?.body)).formDataTicket,
  ).toEqual({});
});
it("retains the draft after create failure and allows retry", async () => {
  createResponse = () =>
    Response.json({ detail: "Create offline" }, { status: 500 });
  renderPage();
  await fillBase();
  await fillDetails();
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByText("Create offline");
  expect(
    (document.getElementById("create-title") as HTMLInputElement).value,
  ).toBe("Yêu cầu TEST");
  createResponse = () => Response.json({ id: 900 });
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByRole("heading", { name: "Đã về danh sách" });
});

it("blocks a handling group whose generated code exceeds 30 characters without changing the draft or making a POST", async () => {
  handlingGroupName = "TEST_20261020_G3CCBK Group OK";
  renderPage();
  await fillBase();
  await fillDetails();
  const group = screen.getByRole("combobox", { name: "Bộ phận xử lý" });
  fireEvent.focus(group);
  fireEvent.blur(group);
  expect(screen.queryByText(/Tên bộ phận xử lý quá dài/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByText(/Tên bộ phận xử lý quá dài.*19 ký tự/);
  expect(document.activeElement).toBe(group);
  expect(calls("/ticket_manager")).toHaveLength(0);
  expect(
    (document.getElementById("create-title") as HTMLInputElement).value,
  ).toBe("Yêu cầu TEST");
  expect(
    (document.getElementById("detail-0-f0") as HTMLInputElement).value,
  ).toBe("Nội dung mẫu");
  handlingGroupName = "ISMS";
  fireEvent.click(screen.getByRole("button", { name: "Tải lại danh mục" }));
  await waitFor(() => expect(group.textContent).toContain("ISMS"));
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByRole("heading", { name: "Đã về danh sách" });
  expect(calls("/ticket_manager")).toHaveLength(1);
  expect(
    JSON.parse(String(calls("/ticket_manager")[0][1]?.body)),
  ).toMatchObject({ handling_group: 5, title: "Yêu cầu TEST" });
});

it("allows a 19-character handling group name without shortening or changing the selected group", async () => {
  handlingGroupName = "A".repeat(19);
  renderPage();
  await fillBase();
  await fillDetails();
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByRole("heading", { name: "Đã về danh sách" });
  expect(calls("/ticket_manager")).toHaveLength(1);
  expect(
    JSON.parse(String(calls("/ticket_manager")[0][1]?.body)).handling_group,
  ).toBe(5);
});
it("retries only failed attachments and never recreates a successful ticket", async () => {
  let uploaded = 0;
  uploadResponse = () =>
    ++uploaded === 2
      ? Response.json({ detail: "Upload offline" }, { status: 500 })
      : Response.json({ message: "success" });
  renderPage();
  await fillBase();
  await fillDetails();
  fireEvent.change(screen.getByLabelText("Tệp đính kèm"), {
    target: {
      files: [new File(["one"], "one.txt"), new File(["two"], "two.txt")],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByText(/đã được tạo/);
  expect(calls("/ticket_manager")).toHaveLength(1);
  expect(calls("/attachmentticketfile")).toHaveLength(2);
  await act(async () => {
    fireEvent.submit(screen.getByRole("form", { name: "Tạo yêu cầu mới" }));
  });
  expect(calls("/ticket_manager")).toHaveLength(1);
  expect(calls("/attachmentticketfile")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Tải lại đính kèm" }));
  await screen.findByRole("heading", { name: "Đã về danh sách" });
  expect(calls("/ticket_manager")).toHaveLength(1);
  expect(calls("/attachmentticketfile")).toHaveLength(3);
  const files = calls("/attachmentticketfile").map(([, options]) =>
    (options?.body as FormData | undefined)?.get("att_file"),
  );
  expect(files[1]).toEqual(files[2]);
});
it("accepts dropped files, avoids duplicates and uploads only the remaining selection", async () => {
  renderPage();
  await fillBase();
  await fillDetails();
  const first = new File(["one"], "one.txt");
  const second = new File(["two"], "two.txt");
  const picker = screen.getByRole("button", { name: "Chọn tệp đính kèm" });
  fireEvent.drop(picker, { dataTransfer: { files: [first, second] } });
  fireEvent.drop(picker, { dataTransfer: { files: [first] } });
  expect(screen.getAllByRole("button", { name: /^Bỏ tệp / })).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Bỏ tệp two.txt" }));
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByRole("heading", { name: "Đã về danh sách" });
  expect(calls("/attachmentticketfile")).toHaveLength(1);
  expect(
    (calls("/attachmentticketfile")[0][1]?.body as FormData | undefined)?.get(
      "att_file",
    ),
  ).toEqual(first);
});
it("blocks duplicate submissions while the real POST is pending", async () => {
  let finish!: (value: Response) => void;
  createResponse = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  renderPage();
  await fillBase();
  await fillDetails();
  const form = screen.getByRole("form", { name: "Tạo yêu cầu mới" });
  fireEvent.submit(form);
  fireEvent.submit(form);
  await waitFor(() => expect(calls("/ticket_manager")).toHaveLength(1));
  expect(
    screen
      .getByRole("button", { name: "Đang gửi..." })
      .hasAttribute("disabled"),
  ).toBe(true);
  await act(async () => finish(Response.json({ id: 900 })));
  await screen.findByRole("heading", { name: "Đã về danh sách" });
});
it.each([
  [1, createTemplate],
  [3, createMultiSectionTemplate],
] as const)(
  "imports and exports only the creation section of a template with %i sections",
  async (_count, groups) => {
    template = { forms: groups };
    renderPage();
    await fillBase();
    await screen.findByRole("group", { name: "Dòng 1" });
    fireEvent.click(screen.getByRole("button", { name: "Tải mẫu" }));
    await waitFor(() =>
      expect(downloadFile).toHaveBeenCalledWith(
        expect.any(NodeBlob),
        "remote-work_mau.xlsx",
      ),
    );
    fireEvent.change(screen.getByLabelText("Nhập chi tiết từ Excel"), {
      target: { files: [new File(["excel"], "template.xlsx")] },
    });
    await waitFor(() =>
      expect(
        (document.getElementById("detail-0-f0") as HTMLInputElement).value,
      ).toBe("Excel"),
    );
    expect(
      (document.getElementById("detail-0-f2") as HTMLInputElement).value,
    ).toBe("20/10/2026");
  },
);
it("blocks form submission until an in-flight Excel import has finished", async () => {
  let finish!: (response: Response) => void;
  renderPage();
  await fillBase();
  await fillDetails();
  pendingImport = new Promise((resolve) => {
    finish = resolve;
  });
  fireEvent.change(screen.getByLabelText("Nhập chi tiết từ Excel"), {
    target: { files: [new File(["excel"], "template.xlsx")] },
  });
  await waitFor(() =>
    expect(calls("/import_excel_ticket_form_data")).toHaveLength(1),
  );
  await act(async () => {
    fireEvent.submit(screen.getByRole("form", { name: "Tạo yêu cầu mới" }));
  });
  expect(calls("/ticket_manager")).toHaveLength(0);
  await act(async () => {
    finish(Response.json(importResponse));
  });
  await waitFor(() =>
    expect(
      (document.getElementById("detail-0-f0") as HTMLInputElement).value,
    ).toBe("Excel"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByRole("heading", { name: "Đã về danh sách" });
  expect(calls("/ticket_manager")).toHaveLength(1);
  expect(
    JSON.parse(String(calls("/ticket_manager")[0][1]?.body)).formDataTicket
      .dataform.data[0]["Ghi chú chi tiết"],
  ).toBe("Excel");
});

it("does not replace existing detail rows for an invalid imported workbook", async () => {
  importResponse = {
    message: "success",
    dataform: { data: [{ wrong: "column", "Số lượng": 2 }] },
  };
  renderPage();
  await fillBase();
  await fillDetails();
  fireEvent.change(screen.getByLabelText("Nhập chi tiết từ Excel"), {
    target: { files: [new File(["excel"], "template.xlsx")] },
  });
  await screen.findByText("Tệp Excel không khớp biểu mẫu đã chọn.");
  expect(
    (document.getElementById("detail-0-f0") as HTMLInputElement).value,
  ).toBe("Nội dung mẫu");
});
it("retries lookup and template failures independently", async () => {
  lookupFailure = true;
  renderPage();
  await screen.findByText(/Lookup offline/);
  lookupFailure = false;
  fireEvent.click(screen.getByRole("button", { name: "Thử lại danh mục" }));
  await ready();
  templateFailure = true;
  await fillBase();
  await screen.findByText(/Template offline/);
  templateFailure = false;
  fireEvent.click(screen.getByRole("button", { name: "Thử lại biểu mẫu" }));
  await screen.findByRole("group", { name: "Dòng 1" });
});
it("does not fetch any data without the create permission", async () => {
  auth.permissions = { can_system: true };
  renderPage();
  await screen.findByText("Bạn chưa có quyền truy cập");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("hydrates a cloned ticket after dependent lookups load and permits changing the group", async () => {
  cloneSource = {
    ...requestDetailFixture,
    handling_group: 5,
    ticket_type: 186,
    approve_user: 42,
    fore_cus: 2,
    bophansudung: 20,
    vanphong: 3,
    other1: "11",
    title: "Bản sao từ ticket",
    data_item: {
      dataform: {
        header: createTemplate,
        data: [
          {
            key: 7,
            "Ghi chú chi tiết": "Giữ nội dung",
            "Số lượng": "0",
            "Từ ngày": "20/10/2026",
            "Đến ngày": "21/10/2026",
            "Khoảng ngày": "20/10/2026 - 22/10/2026",
            "Phương án": "A",
          },
        ],
      },
    },
  };
  renderPage("/requests/new?clone=42");
  await waitFor(() =>
    expect(
      (document.getElementById("detail-0-f0") as HTMLInputElement | null)
        ?.value,
    ).toBe("Giữ nội dung"),
  );
  expect(
    (document.getElementById("detail-0-f1") as HTMLInputElement).value,
  ).toBe("0");
  expect(
    (document.getElementById("create-title") as HTMLInputElement).value,
  ).toBe("Bản sao từ ticket");
  expect(calls("/ticket_manager")).toHaveLength(0);
  await select("Bộ phận xử lý", "IT");
  await screen.findByText("Bộ phận này chưa có loại yêu cầu đang kích hoạt.");
  expect(screen.queryByText(/Không thể sao chép/)).toBeNull();
});

it("blocks a cloned training ticket with an empty required range and associates errors with both date inputs", async () => {
  template = {
    forms: [
      {
        title: "Phần dành cho Bộ phận yêu cầu",
        editable: true,
        children: [
          {
            title: "Thời gian đào tạo (*)",
            type: "range-date-text",
            required: true,
          },
        ],
      },
    ],
  };
  cloneSource = {
    ...requestDetailFixture,
    handling_group: 5,
    ticket_type: 186,
    approve_user: 42,
    fore_cus: 2,
    bophansudung: 20,
    vanphong: 3,
    other1: "11",
    title: "TEST clone training date",
    data_item: {
      dataform: {
        header: (template as { forms: unknown[] }).forms,
        data: [{ key: 1, "Thời gian đào tạo": "" }],
      },
    },
  };
  renderPage("/requests/new?clone=42");
  await screen.findByRole("textbox", { name: "Thời gian đào tạo - Đến ngày" });
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await waitFor(() =>
    expect(
      document.getElementById("detail-0-f0-end")?.getAttribute("aria-invalid"),
    ).toBe("true"),
  );
  expect(
    document.getElementById("detail-0-f0-start")?.getAttribute("aria-invalid"),
  ).toBe("true");
  expect(calls("/ticket_manager")).toHaveLength(0);
  change("detail-0-f0-start", "20/10/2026");
  change("detail-0-f0-end", "19/10/2026");
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await waitFor(() =>
    expect(
      document.getElementById("detail-0-f0-end-error")?.textContent,
    ).toContain("ngày kết thúc không trước ngày bắt đầu"),
  );
  expect(
    document.getElementById("detail-0-f0-start")?.getAttribute("aria-invalid"),
  ).toBe("false");
  expect(calls("/ticket_manager")).toHaveLength(0);
  change("detail-0-f0-end", "20/10/2026");
  fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu" }));
  await screen.findByText("Đã về danh sách");
  const body = JSON.parse(calls("/ticket_manager")[0][1]!.body as string);
  expect(body.formDataTicket.dataform.data[0]["Thời gian đào tạo"]).toBe(
    "20/10/2026 - 20/10/2026",
  );
});
