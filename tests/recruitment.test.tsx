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
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as api from "@/features/recruitment/api/recruitment-api";
import * as addressApi from "@/features/recruitment/api/vietnam-address-api";
vi.mock("@/features/recruitment/api/vietnam-address-api", () => ({
  listVietnamProvinces: vi.fn(),
  listVietnamWards: vi.fn(),
}));
import { RecruitmentList } from "@/features/recruitment/components/recruitment-list";
import { RecruitmentFilters } from "@/features/recruitment/components/recruitment-filters";
import { InterviewCandidateFilters } from "@/features/recruitment/components/interview-candidate-filters";
import { defaultRecruitmentDates } from "@/features/recruitment/utils/recruitment-format";
import { RecruitmentCalendar } from "@/features/recruitment/components/recruitment-calendar";
import { InterviewCandidates } from "@/features/recruitment/components/interview-candidates";
import { RecruitmentEditor } from "@/features/recruitment/components/recruitment-editor";
import { RecruitmentRowActions } from "@/features/recruitment/components/recruitment-row-actions";
import { RecruitmentReport } from "@/features/recruitment/components/recruitment-report";
import { downloadFile } from "@/lib/download";
const auth = vi.hoisted(() => ({ can_hr_rec: true, can_cv_interview: true }));
vi.mock("@/features/auth/hooks/use-auth-context", () => ({
  useAuthContext: () => ({
    userId: 42,
    permissions: auth,
  }),
}));
vi.mock("@/lib/download", () => ({ downloadFile: vi.fn() }));
vi.mock(
  "@/features/recruitment/api/recruitment-api",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/features/recruitment/api/recruitment-api")
    >()),
    listRecruitment: vi.fn(),
    recruitmentLookups: vi.fn(),
    recruitmentDetail: vi.fn(),
    recruitmentWrite: vi.fn(),
    recruitmentArray: vi.fn(),
    recruitmentObject: vi.fn(),
    exportRecruitment: vi.fn(),
    interviewDetail: vi.fn(),
  }),
);
const lookups = {
  departments: [{ value: "1", label: "HR" }],
  cities: [{ value: "01", label: "Hà Nội" }],
  education: [],
  sources: [],
  users: [{ value: "42", label: "test-user" }],
  statuses: [
    { value: "1", label: "Mới" },
    { value: "2", label: "Đã duyệt" },
  ],
};
const request = {
  id: 85,
  ticket_code: "TEST-REC",
  title: "TEST yêu cầu tuyển dụng",
  rec_position: "TEST Developer",
  quantity: "2",
  department_recruited: "1",
  department_recruited_name: "HR",
  ticket_status_name: "Đang xử lý",
  duedate: "2026-11-01",
};
const candidate = {
  id: 408,
  first_name: "TEST Candidate",
  code_cv: "TEST-CV",
  cv_rec_position: "TEST Developer",
  ticket_code: "TEST-REC",
  department_recruited_name: "HR",
  cv_status_id: 1,
  cv_status_name: "Mới",
  gender: "Nam",
  numberphone: "0002610210",
  city_code: "01",
  district_code: "001",
  email: "test@example.invalid",
};
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("PointerEvent", MouseEvent);
  auth.can_hr_rec = true;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn((media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  vi.mocked(api.recruitmentLookups).mockResolvedValue(lookups);
  vi.mocked(addressApi.listVietnamProvinces).mockResolvedValue([
    { value: "01", label: "Hà Nội" },
    { value: "79", label: "Hồ Chí Minh" },
  ]);
  vi.mocked(addressApi.listVietnamWards).mockImplementation(async (province) =>
    province === "01"
      ? [{ value: "00004", label: "Phường Ba Đình" }]
      : [{ value: "26734", label: "Phường Sài Gòn" }],
  );
  vi.mocked(api.listRecruitment).mockImplementation(async (kind) => {
    if (kind === "requests") return { count: 1, results: [request] };
    if (kind === "candidates") return { count: 1, results: [candidate] };
    return { count: 0, results: [] };
  });
  vi.mocked(api.recruitmentDetail).mockImplementation(async (kind) => ({
    row: kind === "requests" ? request : candidate,
    reasons: [],
  }));
  vi.mocked(api.recruitmentArray).mockResolvedValue([
    { id: 1, code: "001", name: "Ba Đình" },
  ]);
  vi.mocked(api.recruitmentWrite).mockResolvedValue({});
  vi.mocked(api.recruitmentObject).mockResolvedValue({
    result_rect: [
      {
        id: 85,
        ticket_code: "TEST-REC",
        rec_position: "Developer",
        number_cv_all: 5,
        quantity: 2,
        number_cv_pass: 1,
      },
    ],
    result_cv_status: { 1: [3, "#000000"] },
  });
  vi.mocked(api.interviewDetail).mockResolvedValue([]);
  vi.mocked(api.exportRecruitment).mockResolvedValue(new Blob(["TEST"]));
});
afterEach(() => {
  cleanup();
  client.clear();
});
function mount(component: React.ReactNode, path = "/recruitment/requests") {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>
    </QueryClientProvider>,
  );
}
function ReportNavigationProbe() {
  const { search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="report-query">{search}</output>
      <button onClick={() => void navigate(-1)}>Lùi lịch sử báo cáo</button>
      <button onClick={() => void navigate(1)}>Tiến lịch sử báo cáo</button>
    </>
  );
}
async function option(label: string, name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  const item = await screen.findByRole("option", { name });
  fireEvent.pointerDown(item, { pointerType: "mouse" });
  fireEvent.click(item);
}
async function openActions(name = "TEST-CV") {
  if (screen.queryByRole("dialog", { name: "Chọn thao tác" })) return;
  const button = await screen.findByRole("button", {
    name: `Thao tác ${name}`,
  });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  fireEvent.click(button);
  await screen.findByRole("dialog", { name: "Chọn thao tác" });
}
it.each([
  {
    mode: "requests",
    manage: false,
    file: false,
    actions: [
      ["request", "Xem yêu cầu"],
      ["create-candidate", "Thêm ứng viên"],
    ],
  },
  {
    mode: "candidates",
    manage: false,
    file: false,
    actions: [
      ["candidate", "Sửa hồ sơ"],
      ["note", "Ghi chú"],
      ["status", "Chuyển trạng thái"],
      ["duplicate", "Kiểm tra trùng"],
      ["attach", "Gắn lịch phỏng vấn"],
      ["delete-candidate", "Xóa hồ sơ"],
    ],
  },
  {
    mode: "candidates",
    manage: false,
    file: true,
    actions: [
      ["candidate", "Sửa hồ sơ"],
      ["note", "Ghi chú"],
      ["status", "Chuyển trạng thái"],
      ["duplicate", "Kiểm tra trùng"],
      ["attach", "Gắn lịch phỏng vấn"],
      ["delete-candidate", "Xóa hồ sơ"],
      ["delete-file", "Xóa tệp CV"],
    ],
  },
  {
    mode: "interview",
    manage: false,
    file: false,
    actions: [
      ["note", "Ghi chú"],
      ["view-candidate", "Xem hồ sơ"],
    ],
  },
  {
    mode: "interview",
    manage: true,
    file: false,
    actions: [
      ["note", "Ghi chú"],
      ["view-candidate", "Xem hồ sơ"],
      ["status", "Chuyển trạng thái"],
      ["candidate-time", "Đặt giờ"],
      ["remove-interview-cv", "Bỏ khỏi lịch"],
      ["candidate", "Sửa hồ sơ"],
    ],
  },
] as const)(
  "shows one action button for $mode, HR=$manage, CV file=$file and dispatches each choice exactly once",
  async ({ mode, manage, file, actions }) => {
    const onAction = vi.fn();
    const row =
      mode === "requests"
        ? request
        : { ...candidate, name_file_cv: file ? "TEST CV.pdf" : "" };
    const name = {
      requests: request.ticket_code,
      candidates: candidate.code_cv,
      interview: candidate.first_name,
    }[mode];
    render(
      <RecruitmentRowActions
        mode={mode}
        row={row}
        canManage={manage}
        disabled={false}
        onAction={onAction}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    for (const [action, label] of actions) {
      if (!screen.queryByRole("dialog", { name: "Chọn thao tác" }))
        fireEvent.click(
          screen.getByRole("button", { name: `Thao tác ${name}` }),
        );
      const dialog = await screen.findByRole("dialog", {
        name: "Chọn thao tác",
      });
      expect(within(dialog).getAllByRole("button")).toHaveLength(
        actions.length + 1,
      );
      fireEvent.click(
        within(dialog).getByRole("button", { name: `${label} ${name}` }),
      );
      expect(onAction).toHaveBeenLastCalledWith(action, row);
      expect(
        screen.getByRole("dialog", { name: "Chọn thao tác" }),
      ).toBeTruthy();
    }
    expect(onAction).toHaveBeenCalledTimes(actions.length);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Chọn thao tác" }), {
      key: "Escape",
    });
    expect(screen.getByRole("dialog", { name: "Chọn thao tác" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Đóng chọn thao tác" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onAction).toHaveBeenCalledTimes(actions.length);
  },
);

it("disables actions during refresh while keeping the chooser open until its X is clicked", async () => {
  const onAction = vi.fn();
  const props = { mode: "candidates" as const, row: candidate, onAction };
  const { rerender } = render(<RecruitmentRowActions {...props} disabled />);
  const button = screen.getByRole("button", { name: "Thao tác TEST-CV" });
  expect(button.hasAttribute("disabled")).toBe(true);
  fireEvent.click(button);
  expect(screen.queryByRole("dialog")).toBeNull();
  rerender(<RecruitmentRowActions {...props} disabled={false} />);
  fireEvent.click(button);
  await screen.findByRole("dialog", { name: "Chọn thao tác" });
  rerender(<RecruitmentRowActions {...props} disabled />);
  expect(
    screen
      .getByRole("button", { name: "Sửa hồ sơ TEST-CV" })
      .hasAttribute("disabled"),
  ).toBe(true);
  rerender(<RecruitmentRowActions {...props} disabled={false} />);
  expect(screen.getByRole("dialog", { name: "Chọn thao tác" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Đóng chọn thao tác" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onAction).not.toHaveBeenCalled();
});
it("loads real-contract requests, only applies draft filters on Search and exports applied values", async () => {
  mount(<RecruitmentList kind="requests" />);
  await screen.findByRole("table", { name: "Bảng yêu cầu tuyển dụng" });
  const initial = vi.mocked(api.listRecruitment).mock.calls.length;
  fireEvent.change(screen.getByLabelText("Tiêu đề"), {
    target: { value: "TEST new filter" },
  });
  expect(api.listRecruitment).toHaveBeenCalledTimes(initial);
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() =>
    expect(api.listRecruitment).toHaveBeenLastCalledWith(
      "requests",
      expect.objectContaining({ title: "TEST new filter", page: "1" }),
      expect.anything(),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
  await waitFor(() => expect(downloadFile).toHaveBeenCalled());
  expect(api.exportRecruitment).toHaveBeenCalledWith(
    "requests",
    expect.objectContaining({ title: "TEST new filter" }),
  );
});
it("shows a retryable list failure without leaking previous rows", async () => {
  vi.mocked(api.listRecruitment).mockRejectedValueOnce(
    new Error("TEST API unavailable"),
  );
  mount(<RecruitmentList kind="requests" />);
  await screen.findByRole("alert");
  expect(screen.queryByText("TEST-REC")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  await screen.findByRole("table", { name: "Bảng yêu cầu tuyển dụng" });
});
it("requires candidate fields before writing and clears errors after corrections", async () => {
  mount(<RecruitmentList kind="requests" />);
  await openActions("TEST-REC");
  const add = await screen.findByRole("button", {
    name: "Thêm ứng viên TEST-REC",
  });
  await waitFor(() => expect(add.hasAttribute("disabled")).toBe(false));
  fireEvent.click(add);
  await screen.findByRole("form", { name: "Thêm ứng viên" });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await screen.findByText("Vui lòng nhập họ và tên.");
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/^Họ và tên/), {
    target: { value: "TEST New Candidate" },
  });
  await waitFor(() =>
    expect(screen.queryByText("Vui lòng nhập họ và tên.")).toBeNull(),
  );
  fireEvent.change(screen.getByLabelText(/^Số điện thoại/), {
    target: { value: "0002610210" },
  });
  await option("Tỉnh/Thành phố", "Hà Nội");
  await option("Xã/Phường/Đặc khu", "Phường Ba Đình");
  fireEvent.change(screen.getByLabelText(/^Địa chỉ/), {
    target: { value: "TEST address" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Thêm ứng viên" })).toBeNull(),
  );
  expect(api.recruitmentWrite).toHaveBeenCalledWith(
    "/detail_cv/85",
    "POST",
    expect.any(FormData),
  );
  const payload = vi.mocked(api.recruitmentWrite).mock.calls[0][2] as FormData;
  expect(JSON.parse(String(payload.get("values")))).toMatchObject({
    city_code: "01",
    district_code: "00004",
  });
});
it("excludes the current CV status and submits status changes using the correct CV", async () => {
  mount(<RecruitmentList kind="candidates" />);
  await openActions();
  const button = await screen.findByRole("button", {
    name: "Chuyển trạng thái TEST-CV",
  });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  fireEvent.click(button);
  await screen.findByRole("form", { name: "Chuyển trạng thái CV" });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await screen.findByText("Vui lòng chọn trạng thái.");
  await option("Trạng thái", "Đã duyệt");
  await waitFor(() =>
    expect(screen.queryByText("Vui lòng chọn trạng thái.")).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Chuyển trạng thái CV" }),
    ).toBeNull(),
  );
  expect(api.recruitmentWrite).toHaveBeenCalledWith(
    "/change_status_cv/408",
    "PUT",
    expect.any(FormData),
  );
  expect(screen.getByRole("dialog", { name: "Chọn thao tác" })).toBeTruthy();
});
it("keeps the chooser behind child forms, ignores Escape, and closes only via its X", async () => {
  mount(<RecruitmentList kind="candidates" />);
  await openActions();
  const chooser = screen.getByRole("dialog", { name: "Chọn thao tác" });
  fireEvent.click(
    within(chooser).getByRole("button", { name: "Sửa hồ sơ TEST-CV" }),
  );
  await screen.findByLabelText(/^Họ và tên/);
  expect(chooser.isConnected).toBe(true);
  expect(chooser.hasAttribute("data-open")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Chi tiết ứng viên" }),
    ).toBeNull(),
  );
  expect(screen.getByRole("dialog", { name: "Chọn thao tác" })).toBe(chooser);
  fireEvent.keyDown(chooser, { key: "Escape" });
  expect(screen.getByRole("dialog", { name: "Chọn thao tác" })).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Kiểm tra trùng TEST-CV" }),
  );
  await screen.findByText("Không tìm thấy hồ sơ trùng lặp.");
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Kiểm tra hồ sơ trùng" }),
    ).toBeNull(),
  );
  expect(screen.getByRole("dialog", { name: "Chọn thao tác" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Đóng chọn thao tác" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
});

it("keeps the chooser open after deleting its row and disables further actions until closed", async () => {
  let exists = true;
  vi.mocked(api.listRecruitment).mockImplementation(async () => ({
    count: exists ? 1 : 0,
    results: exists ? [candidate] : [],
  }));
  vi.mocked(api.recruitmentWrite).mockImplementation(async () => {
    exists = false;
    return {};
  });
  mount(<RecruitmentList kind="candidates" />);
  await openActions();
  fireEvent.click(screen.getByRole("button", { name: "Xóa hồ sơ TEST-CV" }));
  const confirmation = await screen.findByRole("dialog", {
    name: "Xóa hồ sơ ứng viên",
  });
  fireEvent.click(
    within(confirmation).getByRole("button", { name: "Xóa hồ sơ ứng viên" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Xóa hồ sơ ứng viên" }),
    ).toBeNull(),
  );
  const chooser = screen.getByRole("dialog", { name: "Chọn thao tác" });
  expect(
    within(chooser)
      .getByRole("button", { name: "Sửa hồ sơ TEST-CV" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(
    within(chooser).getByRole("button", { name: "Đóng chọn thao tác" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.recruitmentWrite).toHaveBeenCalledTimes(1);
});
it("opens duplicate results without writing candidate records", async () => {
  vi.mocked(api.recruitmentObject).mockResolvedValue({ results: [] });
  mount(<RecruitmentList kind="candidates" />);
  await openActions();
  const button = await screen.findByRole("button", {
    name: "Kiểm tra trùng TEST-CV",
  });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  fireEvent.click(button);
  await screen.findByText("Không tìm thấy hồ sơ trùng lặp.");
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
});
it.each([
  {
    label: "Xóa hồ sơ",
    title: "Xóa hồ sơ ứng viên",
    endpoint: "/del-data-cv/",
    confirmation: /Xóa toàn bộ hồ sơ ứng viên TEST-CV/,
  },
  {
    label: "Xóa tệp CV",
    title: "Xóa tệp CV",
    endpoint: "/del-file-cv/",
    confirmation: /Xóa tệp “TEST CV.pdf” khỏi hồ sơ TEST-CV/,
  },
])(
  "keeps $label separate from the other candidate actions",
  async ({ label, title, endpoint, confirmation }) => {
    vi.mocked(api.listRecruitment).mockResolvedValue({
      count: 1,
      results: [
        {
          ...candidate,
          name_file_cv: "TEST CV.pdf",
          path_file_cv: "/uploads/",
        },
      ],
    });
    mount(<RecruitmentList kind="candidates" />);
    await openActions();
    const action = await screen.findByRole("button", {
      name: `${label} TEST-CV`,
    });
    await waitFor(() => expect(action.hasAttribute("disabled")).toBe(false));
    expect(
      screen.getAllByRole("button", { name: "Xóa hồ sơ TEST-CV" }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: "Xóa tệp CV TEST-CV" }),
    ).toHaveLength(1);
    fireEvent.click(action);
    let dialog = await screen.findByRole("dialog", { name: title });
    expect(within(dialog).getByText(confirmation)).toBeTruthy();
    expect(api.recruitmentWrite).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: title })).toBeNull(),
    );
    expect(api.recruitmentWrite).not.toHaveBeenCalled();
    await openActions();
    fireEvent.click(screen.getByRole("button", { name: `${label} TEST-CV` }));
    dialog = await screen.findByRole("dialog", { name: title });
    fireEvent.click(within(dialog).getByRole("button", { name: title }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: title })).toBeNull(),
    );
    expect(api.recruitmentWrite).toHaveBeenCalledTimes(1);
    expect(api.recruitmentWrite).toHaveBeenCalledWith(
      endpoint,
      "POST",
      expect.anything(),
    );
    const payload = vi.mocked(api.recruitmentWrite).mock.calls[0][2];
    if (payload instanceof FormData) {
      expect(payload.get("id_cv")).toBe("408");
      expect(payload.get("name_file_cv")).toBe("TEST CV.pdf");
    } else expect(payload).toEqual({ id_cv: 408 });
  },
);
it("opens an interview form and blocks reversed time ranges", async () => {
  mount(<RecruitmentCalendar />);
  const add = await screen.findByRole("button", {
    name: "Tạo lịch phỏng vấn",
  });
  await waitFor(() => expect(add.hasAttribute("disabled")).toBe(false));
  fireEvent.click(add);
  await screen.findByRole("dialog");
  fireEvent.change(screen.getByLabelText(/^Tiêu đề/), {
    target: { value: "TEST Interview" },
  });
  fireEvent.change(screen.getByLabelText(/^Ngày phỏng vấn/), {
    target: { value: "31/12/2030" },
  });
  fireEvent.change(screen.getByLabelText(/^Giờ bắt đầu/), {
    target: { value: "11:00" },
  });
  fireEvent.change(screen.getByLabelText(/^Giờ kết thúc/), {
    target: { value: "10:00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await screen.findByText("Giờ kết thúc phải sau giờ bắt đầu.");
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/^Giờ bắt đầu/), {
    target: { value: "09:00" },
  });
  await waitFor(() =>
    expect(screen.queryByText("Giờ kết thúc phải sau giờ bắt đầu.")).toBeNull(),
  );
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(api.recruitmentWrite).toHaveBeenCalledTimes(1));
});
it("renders report tables and charts, supports keyboard tabs and blocks excessive date ranges", async () => {
  mount(<RecruitmentReport />);
  await screen.findByRole("table", { name: "Bảng báo cáo tuyển dụng" });
  expect(
    screen.getByRole("figure", { name: "Biểu đồ số lượng CV" }),
  ).toBeTruthy();
  const first = screen.getByRole("tab", { name: "Theo yêu cầu tuyển dụng" });
  fireEvent.keyDown(first, { key: "End" });
  expect(
    screen
      .getByRole("tab", { name: "Bộ phận theo tháng" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("tab", { name: "Trạng thái CV" }));
  const panel = screen.getByRole("tabpanel");
  expect((await within(panel).findAllByText("3")).length).toBeGreaterThan(0);
  const calls = vi.mocked(api.recruitmentObject).mock.calls.length;
  fireEvent.change(screen.getByLabelText(/^Từ ngày/), {
    target: { value: "01/01/2020" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await screen.findByText("Phạm vi tra cứu không quá 6 tháng.");
  expect(api.recruitmentObject).toHaveBeenCalledTimes(calls);
});
it("restores a recruitment report tab from the URL and gives every tab a decorative icon", async () => {
  mount(<RecruitmentReport />, "/recruitment/reports?tab=result_cv_status");
  const active = screen.getByRole("tab", { name: "Trạng thái CV" });
  expect(active.getAttribute("aria-selected")).toBe("true");
  const panel = screen.getByRole("tabpanel", { name: "Trạng thái CV" });
  expect((await within(panel).findAllByText("3")).length).toBeGreaterThan(0);
  for (const tab of screen.getAllByRole("tab")) {
    expect(tab.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  }
});

it("keeps other query parameters and restores report tabs through browser history without refetching", async () => {
  mount(
    <>
      <RecruitmentReport />
      <ReportNavigationProbe />
    </>,
    "/recruitment/reports?tab=result_rect&search=keep",
  );
  await screen.findByRole("table", { name: "Bảng báo cáo tuyển dụng" });
  const calls = vi.mocked(api.recruitmentObject).mock.calls.length;
  fireEvent.click(screen.getByRole("tab", { name: "Trạng thái CV" }));
  expect(screen.getByTestId("report-query").textContent).toBe(
    "?tab=result_cv_status&search=keep",
  );
  fireEvent.click(screen.getByRole("button", { name: "Lùi lịch sử báo cáo" }));
  await waitFor(() =>
    expect(
      screen
        .getByRole("tab", { name: "Theo yêu cầu tuyển dụng" })
        .getAttribute("aria-selected"),
    ).toBe("true"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Tiến lịch sử báo cáo" }));
  await waitFor(() =>
    expect(
      screen
        .getByRole("tab", { name: "Trạng thái CV" })
        .getAttribute("aria-selected"),
    ).toBe("true"),
  );
  fireEvent.keyDown(screen.getByRole("tab", { name: "Trạng thái CV" }), {
    key: "End",
  });
  expect(screen.getByTestId("report-query").textContent).toBe(
    "?tab=result_department_month&search=keep",
  );
  expect(api.recruitmentObject).toHaveBeenCalledTimes(calls);
});

it("falls back to the first report tab for an unknown URL tab", async () => {
  mount(<RecruitmentReport />, "/recruitment/reports?tab=unknown");
  await screen.findByRole("table", { name: "Bảng báo cáo tuyển dụng" });
  expect(
    screen
      .getByRole("tab", { name: "Theo yêu cầu tuyển dụng" })
      .getAttribute("aria-selected"),
  ).toBe("true");
});

it("waits for delayed district options before saving an existing candidate", async () => {
  let resolveDistricts!: (
    rows: { id: number; code: string; name: string }[],
  ) => void;
  vi.mocked(api.recruitmentArray).mockImplementation((path) =>
    path === "/list_district/"
      ? new Promise((resolve) => {
          resolveDistricts = resolve;
        })
      : Promise.resolve([]),
  );
  mount(
    <RecruitmentEditor
      state={{ action: "candidate", row: candidate }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  await screen.findByLabelText(/^Họ và tên/);
  await waitFor(() => expect(resolveDistricts).toBeTypeOf("function"));
  expect(
    screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.submit(screen.getByRole("form", { name: "Chi tiết ứng viên" }));
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
  resolveDistricts([{ id: 1, code: "001", name: "Ba Đình" }]);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(api.recruitmentWrite).toHaveBeenCalledWith(
      "/detail_cv/408",
      "PUT",
      expect.any(FormData),
    ),
  );
  expect(
    screen.queryByText("Lựa chọn không hợp lệ. Vui lòng chọn lại."),
  ).toBeNull();
});
it("limits interview-only users to viewing profiles and feedback without HR lookups or edit controls", async () => {
  auth.can_hr_rec = false;
  vi.mocked(api.interviewDetail).mockResolvedValue([
    {
      id: 58,
      title: "TEST interview",
      ls_cv_interview: [
        { ...candidate, data_interview_cv: { time_start: "10:15:00" } },
      ],
    },
  ]);
  mount(<InterviewCandidates />);
  await screen.findByRole("table", { name: "CV phỏng vấn" });
  expect(screen.getByText("10:15")).toBeTruthy();
  await openActions("TEST Candidate");
  expect(screen.queryByRole("button", { name: /^Đặt giờ/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Bỏ khỏi lịch/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Sửa hồ sơ/ })).toBeNull();
  expect(
    screen.queryByRole("button", { name: /^Chuyển trạng thái/ }),
  ).toBeNull();
  expect(api.recruitmentLookups).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Xem hồ sơ TEST Candidate" }),
  );
  const profile = await screen.findByRole("dialog", {
    name: "Xem hồ sơ ứng viên",
  });
  await within(profile).findByText("TEST Candidate");
  expect(profile.querySelector("input, textarea, form")).toBeNull();
  expect(within(profile).queryByRole("tablist")).toBeNull();
  expect(screen.queryByRole("button", { name: "Lưu" })).toBeNull();
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
});

function mountInterviewActions() {
  vi.mocked(api.interviewDetail).mockResolvedValue([
    {
      id: 58,
      title: "TEST interview",
      time_start: "04:00:00",
      time_end: "11:00:00",
      ls_cv_interview: [
        { ...candidate, data_interview_cv: { time_start: "10:15:00" } },
      ],
    },
  ]);
  return mount(
    <Routes>
      <Route
        path="/recruitment/interviews/:codeInterview"
        element={<InterviewCandidates />}
      />
    </Routes>,
    "/recruitment/interviews/PV_TEST",
  );
}

it("shows only candidate profile details and the CV in the read-only viewer", async () => {
  const onClose = vi.fn();
  vi.mocked(api.recruitmentDetail).mockResolvedValue({
    row: {
      ...candidate,
      birthday: "2000-01-01",
      city_name: "Thành phố Hà Nội",
      district_name: "Quận Ba Đình",
      address: "TEST address",
      education_level_name: "Đại học",
      education_major: "IT",
      language_skill: "Tiếng Anh",
      cv_status_name: "TEST hidden status",
      why_change_statuscv: "TEST hidden reason",
      note: "TEST hidden note",
      candidate_source_name: "TEST hidden source",
      data_user_received: [{ id: 42, username: "TEST hidden assignee" }],
      path_file_cv: "/uploads/",
      name_file_cv: "TEST CV.docx",
      path_file_interview: "/uploads/",
      name_file_interview: "TEST interview.pdf",
    },
    reasons: [],
  });
  mount(
    <RecruitmentEditor
      state={{ action: "view-candidate", row: candidate }}
      lookups={{}}
      onClose={onClose}
    />,
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Xem hồ sơ ứng viên",
  });
  const profile = within(dialog);
  await profile.findByText("TEST address");
  for (const text of [
    candidate.first_name,
    candidate.numberphone,
    candidate.email,
    "01/01/2000",
    "Thành phố Hà Nội",
    "Quận Ba Đình",
    "Đại học",
    "IT",
    "Tiếng Anh",
  ])
    expect(profile.getByText(text)).toBeTruthy();
  for (const text of [
    "Trạng thái CV",
    "Lý do chuyển trạng thái",
    "Người phụ trách",
    "Nguồn ứng viên",
    "Ngày ứng tuyển",
    "TEST hidden note",
    "TEST hidden status",
    "TEST hidden reason",
    "TEST hidden source",
    "TEST hidden assignee",
    "TEST interview.pdf",
    "Hồ sơ đang sử dụng địa chỉ tỉnh, quận/huyện cũ.",
  ])
    expect(profile.queryByText(text)).toBeNull();
  expect(
    dialog.querySelector(
      "form, input, textarea, [role=combobox], [role=tablist], [aria-required=true]",
    ),
  ).toBeNull();
  expect(api.recruitmentArray).not.toHaveBeenCalled();
  expect(addressApi.listVietnamProvinces).not.toHaveBeenCalled();
  expect(addressApi.listVietnamWards).not.toHaveBeenCalled();
  fireEvent.click(profile.getByRole("button", { name: "TEST CV.docx" }));
  const preview = await screen.findByRole("dialog", { name: "TEST CV.docx" });
  expect(within(preview).getByRole("link", { name: "Tải xuống" })).toBeTruthy();
  fireEvent.click(
    within(preview).getByRole("button", { name: "Đóng xem tệp" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "TEST CV.docx" })).toBeNull(),
  );
  fireEvent.click(profile.getByRole("button", { name: "Đóng" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
});

it.each(["candidates", "interview"] as const)(
  "updates personal data from %s without exposing a second status-changing form",
  async (source) => {
    if (source === "interview") mountInterviewActions();
    else mount(<RecruitmentList kind="candidates" />);
    await openActions(
      source === "interview" ? candidate.first_name : candidate.code_cv,
    );
    const edit = await screen.findByRole("button", {
      name: `Sửa hồ sơ ${source === "interview" ? candidate.first_name : candidate.code_cv}`,
    });
    await waitFor(() => expect(edit.hasAttribute("disabled")).toBe(false));
    fireEvent.click(edit);
    const name = await screen.findByLabelText(/^Họ và tên/);
    const dialog = within(
      screen.getByRole("dialog", { name: "Chi tiết ứng viên" }),
    );
    const status = dialog.getByLabelText("Trạng thái CV") as HTMLInputElement;
    expect(status.disabled).toBe(true);
    expect(status.value).toBe("Mới");
    expect(
      dialog.queryByRole("combobox", { name: "Trạng thái CV" }),
    ).toBeNull();
    expect(dialog.queryByLabelText("Lý do chuyển trạng thái")).toBeNull();
    fireEvent.change(name, { target: { value: "TEST updated candidate" } });
    const save = screen.getByRole("button", { name: "Lưu" });
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false));
    fireEvent.click(save);
    await waitFor(() => expect(api.recruitmentWrite).toHaveBeenCalledTimes(1));
    const [path, method, body] = vi.mocked(api.recruitmentWrite).mock.calls[0];
    expect([path, method]).toEqual(["/detail_cv/408", "PUT"]);
    const values = JSON.parse(String((body as FormData).get("values")));
    expect(values.first_name).toBe("TEST updated candidate");
    expect(values).not.toHaveProperty("cv_status");
    expect(values).not.toHaveProperty("why_change");
  },
);

it("changes status from the interview page through the dedicated transition endpoint", async () => {
  mountInterviewActions();
  await openActions("TEST Candidate");
  const action = await screen.findByRole("button", {
    name: "Chuyển trạng thái TEST Candidate",
  });
  await waitFor(() => expect(action.hasAttribute("disabled")).toBe(false));
  fireEvent.click(action);
  await option("Trạng thái", "Đã duyệt");
  fireEvent.change(screen.getByLabelText("Lý do chuyển trạng thái"), {
    target: { value: "TEST approved" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(api.recruitmentWrite).toHaveBeenCalledTimes(1));
  const [path, method, body] = vi.mocked(api.recruitmentWrite).mock.calls[0];
  expect([path, method]).toEqual(["/change_status_cv/408", "PUT"]);
  expect(Object.fromEntries(body as FormData)).toEqual({
    code_cv: "TEST-CV",
    cv_status: "2",
    why_change: "TEST approved",
  });
});

it("refreshes only the note history after adding feedback, leaving the interview table and lookup APIs untouched", async () => {
  const notes: { id: number; content: string }[] = [
    { id: 1, content: "TEST previous feedback" },
  ];
  vi.mocked(api.recruitmentArray).mockImplementation(async (path) =>
    path.startsWith("/note-cv/") ? [...notes] : [],
  );
  vi.mocked(api.recruitmentWrite).mockImplementation(async () => {
    notes.unshift({ id: 2, content: "TEST new feedback" });
    return {};
  });
  mountInterviewActions();
  const table = await screen.findByRole("table", { name: "CV phỏng vấn" });
  await openActions("TEST Candidate");
  fireEvent.click(
    screen.getByRole("button", { name: "Ghi chú TEST Candidate" }),
  );
  await screen.findByText("TEST previous feedback");
  const reads = () => [
    vi.mocked(api.interviewDetail).mock.calls.length,
    vi.mocked(api.recruitmentLookups).mock.calls.length,
    vi.mocked(api.recruitmentDetail).mock.calls.length,
    vi.mocked(api.listRecruitment).mock.calls.length,
  ];
  const before = reads();
  const historyReads = vi
    .mocked(api.recruitmentArray)
    .mock.calls.filter(([path]) => path.startsWith("/note-cv/")).length;
  fireEvent.change(screen.getByRole("textbox", { name: "Ghi chú phỏng vấn" }), {
    target: { value: "TEST new feedback" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Thêm ghi chú" }));
  await screen.findByText("TEST new feedback");
  expect(reads()).toEqual(before);
  expect(
    vi
      .mocked(api.recruitmentArray)
      .mock.calls.filter(([path]) => path.startsWith("/note-cv/")),
  ).toHaveLength(historyReads + 1);
  expect(table.isConnected).toBe(true);
  expect(
    screen.getByRole("dialog", { name: "Ghi chú phỏng vấn" }),
  ).toBeTruthy();
  expect(screen.queryByText("Đang cập nhật danh sách...")).toBeNull();
});

it("shares profile detail between view and edit, and reloads it only after a successful change", async () => {
  let current = { ...candidate, city_name: "Hà Nội", district_name: "Ba Đình" };
  mountInterviewActions();
  vi.mocked(api.interviewDetail).mockImplementation(async () => [
    { id: 58, ls_cv_interview: [current] },
  ]);
  vi.mocked(api.recruitmentDetail).mockImplementation(async () => ({
    row: current,
    reasons: [],
  }));
  vi.mocked(api.recruitmentWrite).mockImplementation(async () => {
    current = { ...current, first_name: "TEST Changed Name" };
    return {};
  });
  await openActions("TEST Candidate");
  fireEvent.click(
    screen.getByRole("button", { name: "Xem hồ sơ TEST Candidate" }),
  );
  const profile = await screen.findByRole("dialog", {
    name: "Xem hồ sơ ứng viên",
  });
  await within(profile).findByText("TEST Candidate");
  fireEvent.click(within(profile).getByRole("button", { name: "Đóng" }));
  await screen.findByRole("dialog", { name: "Chọn thao tác" });
  fireEvent.click(
    screen.getByRole("button", { name: "Sửa hồ sơ TEST Candidate" }),
  );
  const name = await screen.findByLabelText(/^Họ và tên/);
  expect(api.recruitmentDetail).toHaveBeenCalledTimes(1);
  fireEvent.change(name, { target: { value: "TEST Changed Name" } });
  const save = screen.getByRole("button", { name: "Lưu" });
  await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false));
  const lookupReads = vi.mocked(api.recruitmentLookups).mock.calls.length;
  const districtReads = vi
    .mocked(api.recruitmentArray)
    .mock.calls.filter(([path]) => path === "/list_district/").length;
  fireEvent.click(save);
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Chi tiết ứng viên" }),
    ).toBeNull(),
  );
  expect(api.recruitmentDetail).toHaveBeenCalledTimes(1);
  expect(api.recruitmentLookups).toHaveBeenCalledTimes(lookupReads);
  expect(
    vi
      .mocked(api.recruitmentArray)
      .mock.calls.filter(([path]) => path === "/list_district/"),
  ).toHaveLength(districtReads);
  fireEvent.click(screen.getByRole("button", { name: /^Xem hồ sơ/ }));
  await within(
    screen.getByRole("dialog", { name: "Xem hồ sơ ứng viên" }),
  ).findByText("TEST Changed Name");
  expect(api.recruitmentDetail).toHaveBeenCalledTimes(2);
});

it("preserves interview scroll and table nodes when a background reload changes the row count", async () => {
  mountInterviewActions();
  vi.mocked(api.interviewDetail).mockResolvedValue([
    {
      id: 58,
      ls_cv_interview: [
        candidate,
        { ...candidate, id: 409, first_name: "TEST second" },
      ],
    },
  ]);
  const table = await screen.findByRole("table", { name: "CV phỏng vấn" });
  const scroll = screen.getByRole("region", { name: "Cuộn bảng tuyển dụng" });
  scroll.scrollTop = 250;
  let finish!: (value: (typeof candidate)[]) => void;
  vi.mocked(api.interviewDetail).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = (rows) => resolve([{ id: 58, ls_cv_interview: rows }]);
      }),
  );
  void client.invalidateQueries({
    queryKey: ["recruitment-interview-candidates"],
  });
  await screen.findByText("Đang cập nhật danh sách...");
  expect(screen.getByRole("table", { name: "CV phỏng vấn" })).toBe(table);
  finish([candidate]);
  await waitFor(() =>
    expect(screen.queryByText("Đang cập nhật danh sách...")).toBeNull(),
  );
  expect(screen.getByRole("table", { name: "CV phỏng vấn" })).toBe(table);
  expect(screen.getByRole("region", { name: "Cuộn bảng tuyển dụng" })).toBe(
    scroll,
  );
  expect(scroll.scrollTop).toBe(250);
});

it("does not reserve space above report charts when a tab has no summary metrics", async () => {
  vi.mocked(api.recruitmentObject).mockResolvedValue({
    result_candidate_source: [
      { candidate_source__name: "Giới thiệu", number_cv: 12 },
    ],
  });
  mount(
    <RecruitmentReport />,
    "/recruitment/reports?tab=result_candidate_source",
  );
  const chart = await screen.findByRole("figure", {
    name: "Biểu đồ số lượng CV",
  });
  const panel = screen.getByRole("tabpanel", { name: "Theo nguồn ứng viên" });
  expect(panel.firstElementChild).toBe(chart);
});

it("keeps report chart nodes mounted when report data is refreshed", async () => {
  mount(<RecruitmentReport />);
  const chart = await screen.findByRole("figure", {
    name: "Biểu đồ số lượng CV",
  });
  const table = screen.getByRole("table", { name: "Bảng báo cáo tuyển dụng" });
  const firstRow = within(table).getAllByRole("row")[1];
  const scroll = screen.getByRole("region", { name: "Cuộn bảng tuyển dụng" });
  scroll.scrollTop = 200;
  vi.mocked(api.recruitmentObject).mockResolvedValue({
    result_rect: [
      {
        ...request,
        rec_position: "Developer",
        number_cv_all: 6,
        quantity: 2,
        number_cv_pass: 1,
      },
      {
        ...request,
        id: 86,
        rec_position: "TEST Another Position",
        number_cv_all: 1,
      },
    ],
  });
  await client.invalidateQueries({ queryKey: ["recruitment-report"] });
  await screen.findAllByText("TEST Another Position");
  expect(screen.getByRole("figure", { name: "Biểu đồ số lượng CV" })).toBe(
    chart,
  );
  expect(screen.getByRole("table", { name: "Bảng báo cáo tuyển dụng" })).toBe(
    table,
  );
  expect(scroll.scrollTop).toBe(200);
  expect(within(table).getAllByRole("row")[1]).toBe(firstRow);
});

it("sets the individual interview time without updating the candidate profile or schedule", async () => {
  mountInterviewActions();
  await openActions("TEST Candidate");
  const action = await screen.findByRole("button", {
    name: "Đặt giờ TEST Candidate",
  });
  await waitFor(() => expect(action.hasAttribute("disabled")).toBe(false));
  fireEvent.click(action);
  const time = screen.getByLabelText("Giờ phỏng vấn") as HTMLInputElement;
  expect(time.value).toBe("10:15");
  fireEvent.change(time, { target: { value: "11:30" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await screen.findByText("Giờ phải nằm trong khoảng 04:00 đến 11:00.");
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
  fireEvent.change(time, { target: { value: "03:59" } });
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
  fireEvent.change(time, { target: { value: "10:15" } });
  await waitFor(() =>
    expect(
      screen.queryByText("Giờ phải nằm trong khoảng 04:00 đến 11:00."),
    ).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Chọn giờ phỏng vấn" }));
  expect(
    (await screen.findByRole("button", { name: "Giờ 03" })).hasAttribute(
      "disabled",
    ),
  ).toBe(true);
  expect(
    screen.getByRole("button", { name: "Giờ 12" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Giờ 11" }));
  expect(
    screen.getByRole("button", { name: "Phút 01" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Xong" }));
  expect(time.value).toBe("11:00");
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(api.recruitmentWrite).toHaveBeenCalledExactlyOnceWith(
      "/detail-cv-interview/",
      "POST",
      { id_cv: 408, id_interview: 58, time_start: "11:00" },
    ),
  );
});

it("removes only interview membership after confirmation, keeping the candidate record and status", async () => {
  mountInterviewActions();
  await openActions("TEST Candidate");
  const action = await screen.findByRole("button", {
    name: "Bỏ khỏi lịch TEST Candidate",
  });
  await waitFor(() => expect(action.hasAttribute("disabled")).toBe(false));
  fireEvent.click(action);
  await screen.findByText(
    /Bỏ ứng viên TEST Candidate khỏi lịch phỏng vấn PV_TEST/,
  );
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Bỏ khỏi lịch phỏng vấn" }),
  );
  await waitFor(() =>
    expect(api.recruitmentWrite).toHaveBeenCalledExactlyOnceWith(
      "/del-cv-interview/",
      "DELETE",
      undefined,
      { ls_id_cv: "[408]", code_interview: "PV_TEST" },
    ),
  );
});
it("shows live-contract note content and author in the note modal", async () => {
  vi.mocked(api.recruitmentArray).mockImplementation(async (path) =>
    path.startsWith("/note-cv/")
      ? [
          {
            id: 1,
            content: "TEST feedback persisted",
            fore_user__username: "test-interviewer",
            created: "2026-10-21T08:31:32Z",
            data_file: [{ id: 10, file_name: "TEST interview.pdf" }],
          },
          { id: 2, content: "", data_file: [] },
        ]
      : [],
  );
  mount(
    <RecruitmentEditor
      state={{ action: "note", row: candidate }}
      lookups={{}}
      onClose={vi.fn()}
    />,
  );
  await screen.findByText("TEST feedback persisted");
  expect(screen.getByText(/test-interviewer/)).toBeTruthy();
  const history = screen.getByRole("region", {
    name: "Lịch sử ghi chú phỏng vấn",
  });
  expect(
    within(history).getByRole("heading", { name: "Lịch sử ghi chú phỏng vấn" }),
  ).toBeTruthy();
  expect(
    within(history).getByRole("button", { name: "Mở tệp TEST interview.pdf" }),
  ).toBeTruthy();
  expect(within(history).getByText("Không có nội dung ghi chú.")).toBeTruthy();
  expect(within(history).getByText("Chưa rõ người ghi")).toBeTruthy();
  expect(within(history).getAllByRole("article")).toHaveLength(2);
});
it("preserves unsaved candidate fields and uploads when switching between information and history tabs", async () => {
  mount(
    <RecruitmentEditor
      state={{ action: "candidate", row: candidate }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  await screen.findByRole("tab", { name: "Thông tin" });
  fireEvent.change(screen.getByLabelText(/^Họ và tên/), {
    target: { value: "TEST Modified Candidate" },
  });
  const file = new File(["TEST"], "TEST kept.pdf", { type: "application/pdf" });
  fireEvent.change(screen.getByLabelText("Tệp CV"), {
    target: { files: [file] },
  });
  expect(
    vi
      .mocked(api.recruitmentArray)
      .mock.calls.some(([path]) => path.startsWith("/note-cv/")),
  ).toBe(false);
  fireEvent.click(screen.getByRole("tab", { name: "Lịch sử" }));
  await screen.findByRole("heading", { name: "Lịch sử ghi chú phỏng vấn" });
  expect(screen.queryByRole("button", { name: "Lưu" })).toBeNull();
  expect(screen.queryByRole("textbox", { name: /^Họ và tên/ })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Thông tin" }));
  expect((screen.getByLabelText(/^Họ và tên/) as HTMLInputElement).value).toBe(
    "TEST Modified Candidate",
  );
  expect(screen.getByText("TEST kept.pdf")).toBeTruthy();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(api.recruitmentWrite).toHaveBeenCalledTimes(1));
  const payload = vi.mocked(api.recruitmentWrite).mock.calls[0][2] as FormData;
  expect(JSON.parse(String(payload.get("values")))).toMatchObject({
    first_name: "TEST Modified Candidate",
  });
  expect(payload.get("file_upload")).toBe(file);
});
it("retries failed history requests and shows an empty history without submitting the form", async () => {
  let failed = false;
  vi.mocked(api.recruitmentArray).mockImplementation(async (path) => {
    if (path.startsWith("/note-cv/") && !failed) {
      failed = true;
      throw new Error("TEST history unavailable");
    }
    return [];
  });
  mount(
    <RecruitmentEditor
      state={{ action: "note", row: candidate }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  await screen.findByText("TEST history unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Thử lại lịch sử" }));
  await screen.findByText("Chưa có lịch sử ghi chú phỏng vấn.");
  expect(
    screen.getByRole("textbox", { name: "Ghi chú phỏng vấn" }),
  ).toBeTruthy();
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
});
it.each(["candidates", "interview"] as const)(
  "adds a fresh note from %s without resubmitting old content or creating an empty history entry",
  async (source) => {
    vi.mocked(api.recruitmentArray).mockImplementation(async (path) =>
      path.startsWith("/note-cv/")
        ? [
            {
              id: 7,
              content: "TEST saved feedback",
              fore_user__username: "test-user",
            },
          ]
        : [],
    );
    const row = {
      ...candidate,
      note: "TEST previous note",
      name_file_cv: "TEST CV.pdf",
      path_file_cv: "/uploads/",
      name_file_interview: "TEST previous note.pdf",
      path_file_interview: "/uploads/",
    };
    vi.mocked(api.listRecruitment).mockResolvedValue({
      count: 1,
      results: [row],
    });
    if (source === "interview") {
      mountInterviewActions();
      vi.mocked(api.interviewDetail).mockResolvedValue([
        { id: 58, ls_cv_interview: [row] },
      ]);
    } else mount(<RecruitmentList kind="candidates" />);
    await openActions(source === "interview" ? row.first_name : row.code_cv);
    const action = await screen.findByRole("button", {
      name: `Ghi chú ${source === "interview" ? row.first_name : row.code_cv}`,
    });
    await waitFor(() => expect(action.hasAttribute("disabled")).toBe(false));
    fireEvent.click(action);
    const note = screen.getByRole("textbox", {
      name: "Ghi chú phỏng vấn",
    }) as HTMLTextAreaElement;
    expect(note.value).toBe("");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getAllByRole("form")).toHaveLength(1);
    const history = await screen.findByText("TEST saved feedback");
    expect(history.closest("form")).toBeNull();
    expect(
      screen.getByRole("form").compareDocumentPosition(history) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(api.recruitmentArray).toHaveBeenCalledWith(
      "/note-cv/408",
      undefined,
      expect.any(AbortSignal),
    );
    expect(screen.queryByText("TEST CV.pdf")).toBeNull();
    expect(screen.queryByText("TEST previous note.pdf")).toBeNull();
    fireEvent.change(note, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm ghi chú" }));
    await screen.findByText("Vui lòng nhập ghi chú hoặc đính kèm tệp.");
    expect(api.recruitmentWrite).not.toHaveBeenCalled();
    const file = new File(["TEST"], "TEST feedback.zip");
    fireEvent.change(screen.getByLabelText("Tệp ghi chú phỏng vấn"), {
      target: { files: [file] },
    });
    expect(screen.getByText(file.name)).toBeTruthy();
    expect(
      screen.queryByText("Vui lòng nhập ghi chú hoặc đính kèm tệp."),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thêm ghi chú" }));
    await waitFor(() => expect(api.recruitmentWrite).toHaveBeenCalledTimes(1));
    const [path, method, payload] = vi.mocked(api.recruitmentWrite).mock
      .calls[0];
    expect([path, method]).toEqual(["/note-cv/", "POST"]);
    expect((payload as FormData).get("file_note")).toBe(file);
    expect(JSON.parse(String((payload as FormData).get("values")))).toEqual({
      note: "",
    });
  },
);

it("keeps the note modal open, refreshes history and resets only after a successful save", async () => {
  const onClose = vi.fn();
  const notes: { id: number; content: string; fore_user__username: string }[] =
    [];
  let fail = false;
  vi.mocked(api.recruitmentArray).mockImplementation(async (path) =>
    path.startsWith("/note-cv/") ? [...notes] : [],
  );
  vi.mocked(api.recruitmentWrite).mockImplementation(
    async (_path, _method, body) => {
      if (fail) throw new Error("TEST save note failed");
      const values = JSON.parse(String((body as FormData).get("values")));
      notes.unshift({
        id: notes.length + 1,
        content: values.note,
        fore_user__username: "test-user",
      });
      return {};
    },
  );
  mount(
    <RecruitmentEditor
      state={{ action: "note", row: candidate }}
      lookups={lookups}
      onClose={onClose}
    />,
  );
  await screen.findByText("Chưa có lịch sử ghi chú phỏng vấn.");
  const input = screen.getByRole("textbox", {
    name: "Ghi chú phỏng vấn",
  }) as HTMLTextAreaElement;
  const form = screen.getByRole("form", { name: "Ghi chú phỏng vấn" });
  const attach = () =>
    fireEvent.change(screen.getByLabelText("Tệp ghi chú phỏng vấn"), {
      target: { files: [new File(["TEST"], "TEST feedback.pdf")] },
    });
  fireEvent.change(input, { target: { value: "TEST first note" } });
  attach();
  fireEvent.click(screen.getByRole("button", { name: "Thêm ghi chú" }));
  fireEvent.click(screen.getByRole("button", { name: "Thêm ghi chú" }));
  await screen.findByText("TEST first note");
  await waitFor(() => expect(input.value).toBe(""));
  expect(within(form).queryByText("TEST feedback.pdf")).toBeNull();
  expect(
    screen.getByRole("dialog", { name: "Ghi chú phỏng vấn" }),
  ).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
  expect(api.recruitmentWrite).toHaveBeenCalledTimes(1);
  fail = true;
  fireEvent.change(input, { target: { value: "TEST next note" } });
  attach();
  const submit = screen.getByRole("button", { name: "Thêm ghi chú" });
  await waitFor(() => expect(submit.hasAttribute("disabled")).toBe(false));
  fireEvent.click(submit);
  await screen.findByText("TEST save note failed");
  expect(input.value).toBe("TEST next note");
  expect(within(form).getByText("TEST feedback.pdf")).toBeTruthy();
  expect(notes).toHaveLength(1);
  fail = false;
  fireEvent.click(submit);
  await screen.findByText("TEST next note");
  await waitFor(() => expect(input.value).toBe(""));
  expect(screen.getByText("TEST first note")).toBeTruthy();
  expect(within(form).queryByText("TEST feedback.pdf")).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
  expect(api.recruitmentWrite).toHaveBeenCalledTimes(3);
});

it("groups interview feedback and its attachment in one composer and saves both together", async () => {
  mount(
    <RecruitmentEditor
      state={{ action: "note", row: candidate }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  const input = screen.getByRole("textbox", { name: "Ghi chú phỏng vấn" });
  const composer = input.closest('[data-slot="field"]') as HTMLElement;
  expect(
    within(composer).getByRole("button", {
      name: "Chọn tệp ghi chú phỏng vấn",
    }),
  ).toBeTruthy();
  fireEvent.change(input, { target: { value: "TEST combined feedback" } });
  const spreadsheet = new File(["TEST sheet"], "TEST spreadsheet.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  expect(
    within(composer)
      .getByLabelText("Tệp ghi chú phỏng vấn")
      .getAttribute("accept"),
  ).toBeNull();
  fireEvent.drop(input, { dataTransfer: { files: [spreadsheet] } });
  expect(within(composer).getByText("TEST spreadsheet.xlsx")).toBeTruthy();
  const tooLarge = new File(["TEST"], "TEST large.pdf");
  Object.defineProperty(tooLarge, "size", { value: 51 * 1024 * 1024 });
  fireEvent.change(within(composer).getByLabelText("Tệp ghi chú phỏng vấn"), {
    target: { files: [tooLarge] },
  });
  await screen.findByText("Tệp không được vượt quá 50 MB.");
  expect(
    screen
      .getByRole("button", { name: "Thêm ghi chú" })
      .hasAttribute("disabled"),
  ).toBe(true);
  const file = new File(["TEST feedback"], "TEST feedback.pdf", {
    type: "application/pdf",
  });
  fireEvent.change(within(composer).getByLabelText("Tệp ghi chú phỏng vấn"), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(screen.queryByText("Tệp không được vượt quá 50 MB.")).toBeNull(),
  );
  expect(
    within(composer).getByRole("button", { name: "Bỏ tệp TEST feedback.pdf" }),
  ).toBeTruthy();
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Thêm ghi chú" }));
  await waitFor(() => expect(api.recruitmentWrite).toHaveBeenCalledTimes(1));
  const [url, method, payload] = vi.mocked(api.recruitmentWrite).mock.calls[0];
  expect(url).toBe("/note-cv/");
  expect(method).toBe("POST");
  expect(JSON.parse(String((payload as FormData).get("values")))).toMatchObject(
    { note: "TEST combined feedback" },
  );
  expect((payload as FormData).get("file_note")).toBe(file);
});
it("clears a date range error as either date is corrected without fetching a draft", async () => {
  mount(<RecruitmentReport />);
  await screen.findByRole("table", { name: "Bảng báo cáo tuyển dụng" });
  fireEvent.change(screen.getByLabelText(/^Từ ngày/), {
    target: { value: "22/10/2026" },
  });
  fireEvent.change(screen.getByLabelText(/^Đến ngày/), {
    target: { value: "21/10/2026" },
  });
  const initial = vi.mocked(api.recruitmentObject).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await screen.findByText("Ngày kết thúc phải từ ngày bắt đầu trở đi.");
  expect(api.recruitmentObject).toHaveBeenCalledTimes(initial);
  fireEvent.change(screen.getByLabelText(/^Đến ngày/), {
    target: { value: "23/10/2026" },
  });
  await waitFor(() =>
    expect(
      screen.queryByText("Ngày kết thúc phải từ ngày bắt đầu trở đi."),
    ).toBeNull(),
  );
  expect(api.recruitmentObject).toHaveBeenCalledTimes(initial);
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() =>
    expect(api.recruitmentObject).toHaveBeenLastCalledWith(
      "/report_rect/",
      { from_date: "2026-10-22", to_date: "2026-10-23" },
      expect.anything(),
    ),
  );
});
it("refetches the list when Search is clicked again with unchanged applied filters", async () => {
  mount(<RecruitmentList kind="requests" />);
  await screen.findByRole("table", { name: "Bảng yêu cầu tuyển dụng" });
  const initial = vi.mocked(api.listRecruitment).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() =>
    expect(api.listRecruitment).toHaveBeenCalledTimes(initial + 1),
  );
});
it("keeps CV validation in the profile form without exposing interview-note uploads", async () => {
  mount(
    <RecruitmentEditor
      state={{ action: "candidate", row: candidate }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  await screen.findByLabelText(/^Họ và tên/);
  const oversized = new File(["TEST"], "TEST_large.pdf", {
    type: "application/pdf",
  });
  Object.defineProperty(oversized, "size", { value: 11 * 1024 * 1024 });
  fireEvent.change(screen.getByLabelText("Tệp CV"), {
    target: { files: [oversized] },
  });
  await screen.findByText("Tệp không được vượt quá 10 MB.");
  expect(screen.queryByLabelText("Tệp ghi chú phỏng vấn")).toBeNull();
  expect(screen.queryByLabelText("Ghi chú / File phỏng vấn")).toBeNull();
  expect(screen.getByText("Tệp không được vượt quá 10 MB.")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.submit(screen.getByRole("form", { name: "Chi tiết ứng viên" }));
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Tệp CV"), { target: { files: [] } });
  await waitFor(() =>
    expect(screen.queryByText("Tệp không được vượt quá 10 MB.")).toBeNull(),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
});
it("does not allow list actions, selection or bulk assignment against rows being refreshed", async () => {
  mount(<RecruitmentList kind="candidates" />);
  const checkbox = await screen.findByRole("checkbox", {
    name: "Chọn CV TEST-CV",
  });
  await waitFor(() =>
    expect(
      screen
        .getByRole("checkbox", { name: "Chọn CV TEST-CV" })
        .hasAttribute("data-disabled"),
    ).toBe(false),
  );
  fireEvent.click(checkbox);
  expect(
    screen
      .getByRole("button", { name: "Gắn lịch (1)" })
      .hasAttribute("disabled"),
  ).toBe(false);
  let finish!: (value: {
    count: number;
    results: (typeof candidate)[];
  }) => void;
  vi.mocked(api.listRecruitment).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  void client.invalidateQueries({ queryKey: ["recruitment-list"] });
  await waitFor(() =>
    expect(
      screen
        .getByRole("checkbox", { name: "Chọn CV TEST-CV" })
        .hasAttribute("data-disabled"),
    ).toBe(true),
  );
  expect(
    screen
      .getByRole("button", { name: "Thao tác TEST-CV" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("button", { name: "Gắn lịch (1)" })
      .hasAttribute("disabled"),
  ).toBe(true);
  finish({ count: 1, results: [candidate] });
  await waitFor(() =>
    expect(
      screen
        .getByRole("checkbox", { name: "Chọn CV TEST-CV" })
        .hasAttribute("data-disabled"),
    ).toBe(false),
  );
});
it("creates an interview for the selected calendar date and does not jump back to today", async () => {
  mount(<RecruitmentCalendar />);
  await screen.findByRole("grid", { name: "Lịch phỏng vấn" });
  fireEvent.change(screen.getByLabelText(/^Ngày xem lịch/), {
    target: { value: "10/12/2030" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() =>
    expect(api.listRecruitment).toHaveBeenLastCalledWith(
      "interviews",
      expect.objectContaining({ from_date: "2030-12-09" }),
      expect.anything(),
    ),
  );
  const button = screen.getByRole("button", { name: "Tạo lịch phỏng vấn" });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  fireEvent.click(button);
  expect(
    (await screen.findByLabelText(/^Ngày phỏng vấn/)).getAttribute("value"),
  ).toBe("10/12/2030");
});
it("applies and resets interview candidate filters using the shared form controls", async () => {
  vi.mocked(api.interviewDetail).mockResolvedValue([
    { id: 58, title: "TEST interview", ls_cv_interview: [candidate] },
  ]);
  mount(<InterviewCandidates />);
  await screen.findByRole("table", { name: "CV phỏng vấn" });
  fireEvent.change(screen.getByLabelText("Tìm ứng viên phỏng vấn"), {
    target: { value: "  TEST Candidate  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
  await option("Giới tính ứng viên", "Nam");
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
  await waitFor(() =>
    expect(api.interviewDetail).toHaveBeenLastCalledWith(
      "",
      { search: "TEST Candidate", gender: "Nam", cv_status: "" },
      expect.anything(),
    ),
  );
  const reset = await screen.findByRole("button", {
    name: "Xóa lọc tuyển dụng",
  });
  await waitFor(() => expect(reset.hasAttribute("disabled")).toBe(false));
  fireEvent.click(reset);
  await waitFor(() =>
    expect(api.interviewDetail).toHaveBeenLastCalledWith(
      "",
      { search: "", gender: "", cv_status: "" },
      expect.anything(),
    ),
  );
  expect(
    (screen.getByLabelText("Tìm ứng viên phỏng vấn") as HTMLInputElement).value,
  ).toBe("");
});

function SelectionHistory() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate("/recruitment/candidates?page=2")}>
        Trang thử tiếp theo
      </button>
      <button onClick={() => navigate(-1)}>Quay lại trang thử</button>
    </>
  );
}
it("clears selected candidates across browser history and pagination changes", async () => {
  vi.mocked(api.listRecruitment).mockImplementation(async (_kind, values) => ({
    count: 20,
    results: [
      values.page === "2"
        ? { ...candidate, id: 409, code_cv: "TEST-CV-2" }
        : candidate,
    ],
  }));
  mount(
    <>
      <RecruitmentList kind="candidates" />
      <SelectionHistory />
    </>,
    "/recruitment/candidates",
  );
  const checkbox = await screen.findByRole("checkbox", {
    name: "Chọn CV TEST-CV",
  });
  await waitFor(() =>
    expect(checkbox.hasAttribute("data-disabled")).toBe(false),
  );
  fireEvent.click(checkbox);
  await screen.findByRole("button", { name: "Gắn lịch (1)" });
  fireEvent.click(screen.getByRole("button", { name: "Trang thử tiếp theo" }));
  await screen.findByRole("checkbox", { name: "Chọn CV TEST-CV-2" });
  expect(
    screen
      .getByRole("button", { name: "Gắn lịch (0)" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Quay lại trang thử" }));
  const restored = await screen.findByRole("checkbox", {
    name: "Chọn CV TEST-CV",
  });
  expect(restored.getAttribute("aria-checked")).toBe("false");
  expect(
    screen
      .getByRole("button", { name: "Gắn lịch (0)" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

it("uses the requests drawer, discards unapplied drafts and clears only advanced filters", async () => {
  mount(<RecruitmentList kind="candidates" />);
  await screen.findByRole("table", { name: "Bảng ứng viên" });
  expect(screen.queryByRole("dialog", { name: "Lọc nâng cao" })).toBeNull();
  const initial = vi.mocked(api.listRecruitment).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
  await screen.findByRole("dialog", { name: "Lọc nâng cao" });
  fireEvent.change(screen.getByLabelText("Mã yêu cầu tuyển dụng"), {
    target: { value: "TEST-HR" },
  });
  expect(api.listRecruitment).toHaveBeenCalledTimes(initial);
  fireEvent.click(screen.getByRole("button", { name: "Đóng bộ lọc nâng cao" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.change(screen.getByLabelText("Tìm kiếm"), {
    target: { value: "TEST" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
  await screen.findByRole("dialog");
  expect(screen.queryByRole("combobox", { name: "Giới tính" })).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Tỉnh/Thành phố" })).toBeNull();
  expect(
    screen.getByLabelText("Mã yêu cầu tuyển dụng").getAttribute("value"),
  ).toBe("");
  fireEvent.change(screen.getByLabelText("Mã yêu cầu tuyển dụng"), {
    target: { value: "TEST-HR" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() =>
    expect(api.listRecruitment).toHaveBeenLastCalledWith(
      "candidates",
      expect.objectContaining({ search: "TEST", ticket_code: "TEST-HR" }),
      expect.anything(),
    ),
  );
  expect(api.listRecruitment).toHaveBeenCalledTimes(initial + 1);
  expect(
    screen
      .getByRole("button", { name: "Lọc nâng cao" })
      .getAttribute("aria-description"),
  ).toBe("1 điều kiện lọc nâng cao đang áp dụng");
  fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
  const clear = await screen.findByRole("button", {
    name: "Xóa bộ lọc nâng cao",
  });
  await waitFor(() => expect(clear.hasAttribute("disabled")).toBe(false));
  fireEvent.click(clear);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() =>
    expect(api.listRecruitment).toHaveBeenLastCalledWith(
      "candidates",
      expect.objectContaining({ search: "TEST", ticket_code: "" }),
      expect.anything(),
    ),
  );
});
it("opens advanced fields automatically when a hidden date range fails validation", async () => {
  const onApply = vi.fn();
  mount(
    <RecruitmentFilters
      mode="requests"
      values={{ from_date: "2026-10-22", to_date: "2026-10-21" }}
      lookups={lookups}
      busy={false}
      onApply={onApply}
      onReset={vi.fn()}
    />,
  );
  expect(screen.queryByRole("textbox", { name: /^Từ ngày/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await screen.findByText("Ngày kết thúc phải từ ngày bắt đầu trở đi.");
  expect(screen.getByRole("dialog", { name: "Lọc nâng cao" })).toBeTruthy();
  expect(screen.getByRole("textbox", { name: /^Từ ngày/ })).toBeTruthy();
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: /^Đến ngày/ }), {
    target: { value: "23/10/2026" },
  });
  await waitFor(() =>
    expect(
      screen.queryByText("Ngày kết thúc phải từ ngày bắt đầu trở đi."),
    ).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
  await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("blocks invalid department filters and validates again when clearing advanced filters", async () => {
  const onApply = vi.fn();
  mount(
    <RecruitmentFilters
      mode="requests"
      values={{
        from_date: "2026-10-21",
        to_date: "2026-10-22",
        department_recruited: "999",
        ticket_status: "999",
      }}
      lookups={lookups}
      busy={false}
      onApply={onApply}
      onReset={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await screen.findByRole("dialog", { name: "Lọc nâng cao" });
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc nâng cao" }));
  await screen.findByText("Lựa chọn không hợp lệ. Vui lòng chọn lại.");
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Lọc nâng cao" }), {
    key: "Escape",
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await option("Trạng thái yêu cầu", "Đã phê duyệt");
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await screen.findByRole("dialog", { name: "Lọc nâng cao" });
  fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc nâng cao" }));
  await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({ ticket_status: "2", department_recruited: "" }),
  );
});
it("shows and recovers from an invalid hidden interview candidate gender", async () => {
  const onApply = vi.fn();
  mount(
    <InterviewCandidateFilters
      values={{ search: " TEST ", gender: "unknown", cv_status: "1" }}
      statuses={lookups.statuses}
      busy={false}
      onApply={onApply}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await screen.findByText("Giới tính không hợp lệ.");
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc nâng cao" }));
  await waitFor(() =>
    expect(onApply).toHaveBeenCalledWith({
      search: "TEST",
      gender: "",
      cv_status: "1",
    }),
  );
});
it("retries schedule options after a failure and saves only a schedule from the selected date", async () => {
  client.setQueryData(
    ["recruitment-notes", 42, candidate.id],
    [{ id: 1, content: "TEST cached private note" }],
  );
  vi.mocked(api.listRecruitment)
    .mockRejectedValueOnce(new Error("TEST schedules unavailable"))
    .mockResolvedValue({
      count: 1,
      results: [
        {
          id: 58,
          title: "TEST Interview",
          time_start: "09:00",
          time_end: "10:00",
        },
      ],
    });
  mount(
    <RecruitmentEditor
      state={{
        action: "attach",
        row: {
          ...candidate,
          start_date: "2026-10-22",
          path_file_cv: "/media/cv.pdf",
          name_file_cv: "TEST unrelated CV.pdf",
        },
      }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  const retry = await screen.findByRole("button", {
    name: "Thử lại lịch phỏng vấn",
  });
  expect(screen.queryByText("TEST cached private note")).toBeNull();
  expect(screen.queryByText("TEST unrelated CV.pdf")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.submit(
    screen.getByRole("form", { name: "Thêm ứng viên vào lịch phỏng vấn" }),
  );
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
  fireEvent.click(retry);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  await option("Lịch phỏng vấn", "TEST Interview (09:00 - 10:00)");
  fireEvent.change(screen.getByLabelText(/^Ngày phỏng vấn/), {
    target: { value: "23/10/2026" },
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(screen.queryByText("Vui lòng chọn lịch phỏng vấn.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await screen.findByText("Vui lòng chọn lịch phỏng vấn.");
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
  await option("Lịch phỏng vấn", "TEST Interview (09:00 - 10:00)");
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(api.recruitmentWrite).toHaveBeenCalledTimes(1));
  expect(
    (vi.mocked(api.recruitmentWrite).mock.calls[0][2] as FormData).get(
      "id_interview",
    ),
  ).toBe("58");
  expect(
    (vi.mocked(api.recruitmentWrite).mock.calls[0][2] as FormData).get(
      "ls_id_cv",
    ),
  ).toBe("[408]");
});
it("explains empty interview dates and only enables saving after schedules load", async () => {
  vi.mocked(api.listRecruitment).mockResolvedValue({ count: 0, results: [] });
  mount(
    <RecruitmentEditor
      state={{ action: "attach", row: candidate }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText(/^Ngày phỏng vấn/), {
    target: { value: "21/10/2026" },
  });
  await screen.findByText(
    "Không có lịch phỏng vấn trong ngày đã chọn. Vui lòng chọn ngày khác.",
  );
  expect(screen.queryByText("Vui lòng chọn lịch phỏng vấn.")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
  ).toBe(true);
  let resolve!: (value: {
    count: number;
    results: {
      id: number;
      title: string;
      time_start: string;
      time_end: string;
    }[];
  }) => void;
  vi.mocked(api.listRecruitment).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  fireEvent.change(screen.getByLabelText(/^Ngày phỏng vấn/), {
    target: { value: "22/10/2026" },
  });
  await screen.findByText("Đang tải lịch phỏng vấn...");
  expect(
    screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.submit(
    screen.getByRole("form", { name: "Thêm ứng viên vào lịch phỏng vấn" }),
  );
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
  resolve({
    count: 1,
    results: [
      {
        id: 58,
        title: "TEST Interview",
        time_start: "09:00",
        time_end: "10:00",
      },
    ],
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(
    screen.queryByText(
      "Không có lịch phỏng vấn trong ngày đã chọn. Vui lòng chọn ngày khác.",
    ),
  ).toBeNull();
  expect(api.listRecruitment).toHaveBeenLastCalledWith(
    "interviews",
    { from_date: "2026-10-22", to_date: "2026-10-22" },
    expect.anything(),
  );
});
it("attaches all selected candidates and allows retrying a rejected save without losing the schedule", async () => {
  const onClose = vi.fn();
  vi.mocked(api.listRecruitment).mockResolvedValue({
    count: 1,
    results: [
      {
        id: 58,
        title: "TEST Interview",
        time_start: "09:00",
        time_end: "10:00",
      },
    ],
  });
  vi.mocked(api.recruitmentWrite)
    .mockRejectedValueOnce(new Error("TEST assignment failed"))
    .mockResolvedValue({});
  mount(
    <RecruitmentEditor
      state={{ action: "attach", row: {}, ids: [408, 409] }}
      lookups={lookups}
      onClose={onClose}
    />,
  );
  expect(screen.getByText("Đã chọn 2 ứng viên.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/^Ngày phỏng vấn/), {
    target: { value: "22/10/2026" },
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  await option("Lịch phỏng vấn", "TEST Interview (09:00 - 10:00)");
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await screen.findByText("TEST assignment failed");
  expect(api.recruitmentWrite).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
  expect(
    screen.getByRole("combobox", { name: "Lịch phỏng vấn" }).textContent,
  ).toContain("TEST Interview");
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(api.recruitmentWrite).toHaveBeenCalledTimes(2);
  for (const [url, method, body] of vi.mocked(api.recruitmentWrite).mock
    .calls) {
    expect(url).toBe("/add-cv-interview/");
    expect(method).toBe("POST");
    expect(Object.fromEntries((body as FormData).entries())).toEqual({
      ls_id_cv: "[408,409]",
      id_interview: "58",
    });
  }
});
it("keeps report dates visible without an empty advanced-search section", () => {
  mount(
    <RecruitmentFilters
      mode="reports"
      values={defaultRecruitmentDates()}
      lookups={{}}
      busy={false}
      onApply={vi.fn()}
      onReset={vi.fn()}
    />,
  );
  expect(screen.getByRole("textbox", { name: /^Từ ngày/ })).toBeTruthy();
  expect(screen.getByRole("textbox", { name: /^Đến ngày/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Lọc nâng cao" })).toBeNull();
});

it("uses shared pagination for interview CVs without refetching the full API dataset", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({
    ...candidate,
    id: index + 1000,
    first_name: `TEST-PAGE-${index + 1}`,
  }));
  vi.mocked(api.interviewDetail).mockResolvedValue([
    { id: 58, title: "TEST interview", ls_cv_interview: rows },
  ]);
  mount(<InterviewCandidates />);
  const table = await screen.findByRole("table", { name: "CV phỏng vấn" });
  expect(within(table).getByText("TEST-PAGE-100")).toBeTruthy();
  expect(within(table).queryByText("TEST-PAGE-101")).toBeNull();
  const calls = vi.mocked(api.interviewDetail).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  expect(within(table).getByText("TEST-PAGE-101")).toBeTruthy();
  expect(api.interviewDetail).toHaveBeenCalledTimes(calls);
  fireEvent.change(screen.getByLabelText("Tìm ứng viên phỏng vấn"), {
    target: { value: "TEST" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Trang trước" })
        .hasAttribute("disabled"),
    ).toBe(true),
  );
});

it("paginates report tables while totals and charts use the complete dataset", async () => {
  vi.mocked(api.recruitmentObject).mockResolvedValue({
    result_rect: Array.from({ length: 101 }, (_, index) => ({
      id: index + 1,
      ticket_code: `TEST-REPORT-${index + 1}`,
      number_cv_all: 1,
    })),
  });
  mount(<RecruitmentReport />);
  const table = await screen.findByRole("table", {
    name: "Bảng báo cáo tuyển dụng",
  });
  expect(within(table).queryByText("TEST-REPORT-101")).toBeNull();
  expect(screen.getByText("101")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  expect(within(table).getByText("TEST-REPORT-101")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Theo bộ phận" }));
  await screen.findByText(
    "Không có dữ liệu báo cáo trong khoảng thời gian đã chọn.",
  );
  expect(screen.queryByRole("button", { name: "Trang sau" })).toBeNull();
});

it("shows V2 recruitment metadata and Vietnam-style due dates without allowing ticket fields to be overwritten", async () => {
  vi.mocked(api.recruitmentDetail).mockResolvedValue({
    row: {
      ...request,
      other_skill: "TEST kỹ năng khác",
      user_update_name: "test-editor",
    },
    reasons: [],
  });
  mount(
    <RecruitmentEditor
      state={{ action: "request", row: request }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  const due = await screen.findByLabelText("Ngày hết hạn");
  await waitFor(() =>
    expect((due as HTMLInputElement).value).toBe("01/11/2026"),
  );
  expect(due.hasAttribute("disabled")).toBe(true);
  expect(
    (screen.getByLabelText("Kỹ năng khác") as HTMLInputElement).value,
  ).toBe("TEST kỹ năng khác");
  expect(screen.getByLabelText("Kỹ năng khác").hasAttribute("disabled")).toBe(
    true,
  );
  expect(
    (screen.getByLabelText("Người cập nhật") as HTMLInputElement).value,
  ).toBe("test-editor");
});
it("saves an existing candidate without changing legacy address codes", async () => {
  mount(
    <RecruitmentEditor
      state={{ action: "candidate", row: candidate }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  await screen.findByRole("combobox", { name: "Quận/Huyện (địa chỉ cũ)" });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(api.recruitmentWrite).toHaveBeenCalled());
  const payload = vi.mocked(api.recruitmentWrite).mock.calls[0][2] as FormData;
  expect(JSON.parse(String(payload.get("values")))).toMatchObject({
    city_code: "01",
    district_code: "001",
  });
  expect(addressApi.listVietnamProvinces).not.toHaveBeenCalled();
  expect(addressApi.listVietnamWards).not.toHaveBeenCalled();
});
it("preserves a legacy address until the user explicitly switches to the new hierarchy", async () => {
  mount(
    <RecruitmentEditor
      state={{ action: "candidate", row: candidate }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  await screen.findByRole("combobox", { name: "Quận/Huyện (địa chỉ cũ)" });
  expect(addressApi.listVietnamProvinces).not.toHaveBeenCalled();
  expect(
    screen.getByText("Hồ sơ đang sử dụng địa chỉ tỉnh, quận/huyện cũ."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Chọn địa chỉ mới" }));
  expect(screen.queryByText("Vui lòng chọn tỉnh/thành phố.")).toBeNull();
  await option("Tỉnh/Thành phố", "Hà Nội");
  await waitFor(() =>
    expect(screen.queryByText("Vui lòng chọn tỉnh/thành phố.")).toBeNull(),
  );
  await option("Xã/Phường/Đặc khu", "Phường Ba Đình");
  await option("Tỉnh/Thành phố", "Hồ Chí Minh");
  await waitFor(() =>
    expect(
      screen.queryByRole("combobox", { name: "Xã/Phường/Đặc khu" })
        ?.textContent,
    ).not.toContain("Phường Ba Đình"),
  );
  await option("Xã/Phường/Đặc khu", "Phường Sài Gòn");
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(api.recruitmentWrite).toHaveBeenCalled());
  const calls = vi.mocked(api.recruitmentWrite).mock.calls;
  const call = calls[calls.length - 1];
  const values = JSON.parse(String((call[2] as FormData).get("values")));
  expect(values).toMatchObject({ city_code: "79", district_code: "26734" });
});
it("does not validate untouched wards when choosing or changing a province before saving", async () => {
  mount(
    <RecruitmentEditor
      state={{ action: "create-candidate", row: request }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  await screen.findByRole("form", { name: "Thêm ứng viên" });
  await option("Tỉnh/Thành phố", "Hà Nội");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(screen.queryByText("Vui lòng chọn xã/phường/đặc khu.")).toBeNull();
  await option("Xã/Phường/Đặc khu", "Phường Ba Đình");
  await waitFor(() =>
    expect(screen.queryByText("Vui lòng chọn xã/phường/đặc khu.")).toBeNull(),
  );
  expect(
    screen
      .getByRole("combobox", { name: "Xã/Phường/Đặc khu" })
      .getAttribute("aria-invalid"),
  ).toBe("false");
  await option("Tỉnh/Thành phố", "Hồ Chí Minh");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(screen.queryByText("Vui lòng chọn xã/phường/đặc khu.")).toBeNull();
  expect(
    screen.getByRole("combobox", { name: "Xã/Phường/Đặc khu" }).textContent,
  ).not.toContain("Phường Ba Đình");
  await option("Xã/Phường/Đặc khu", "Phường Sài Gòn");
  await waitFor(() =>
    expect(screen.queryByText("Vui lòng chọn xã/phường/đặc khu.")).toBeNull(),
  );
  await option("Tỉnh/Thành phố", "Hà Nội");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(screen.queryByText("Vui lòng chọn xã/phường/đặc khu.")).toBeNull();
  await option("Xã/Phường/Đặc khu", "Phường Ba Đình");
  await waitFor(() =>
    expect(screen.queryByText("Vui lòng chọn xã/phường/đặc khu.")).toBeNull(),
  );
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
});
it("validates a missing ward on save and clears the error after a valid selection", async () => {
  mount(
    <RecruitmentEditor
      state={{ action: "create-candidate", row: request }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  await screen.findByRole("form", { name: "Thêm ứng viên" });
  await option("Tỉnh/Thành phố", "Hà Nội");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await screen.findByText("Vui lòng chọn xã/phường/đặc khu.");
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
  await option("Xã/Phường/Đặc khu", "Phường Ba Đình");
  await waitFor(() =>
    expect(screen.queryByText("Vui lòng chọn xã/phường/đặc khu.")).toBeNull(),
  );
  await option("Tỉnh/Thành phố", "Hồ Chí Minh");
  await screen.findByText("Vui lòng chọn xã/phường/đặc khu.");
  await option("Xã/Phường/Đặc khu", "Phường Sài Gòn");
  await waitFor(() =>
    expect(screen.queryByText("Vui lòng chọn xã/phường/đặc khu.")).toBeNull(),
  );
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
});
it("resolves a modern ward name when viewing a saved candidate with no backend district name", async () => {
  vi.mocked(api.recruitmentDetail).mockResolvedValue({
    row: { ...candidate, district_code: "00004", district_name: null },
    reasons: [],
  });
  mount(
    <RecruitmentEditor
      state={{
        action: "view-candidate",
        row: { ...candidate, district_code: "00004" },
      }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  await screen.findByText("Phường Ba Đình");
  expect(screen.getByText("Hà Nội")).toBeTruthy();
});
it("blocks candidate saving while public address options are unavailable and supports retry", async () => {
  vi.mocked(addressApi.listVietnamProvinces).mockRejectedValueOnce(
    new Error("TEST unavailable"),
  );
  mount(
    <RecruitmentEditor
      state={{ action: "create-candidate", row: request }}
      lookups={lookups}
      onClose={vi.fn()}
    />,
  );
  await screen.findByRole("button", { name: "Thử lại địa chỉ" });
  expect(
    screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Thử lại địa chỉ" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Thử lại địa chỉ" }),
    ).toBeNull(),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lưu" }).hasAttribute("disabled"),
    ).toBe(false),
  );
});
