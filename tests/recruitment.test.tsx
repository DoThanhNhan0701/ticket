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
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as api from "@/features/recruitment/api/recruitment-api";
import { RecruitmentList } from "@/features/recruitment/components/recruitment-list";
import { RecruitmentFilters } from "@/features/recruitment/components/recruitment-filters";
import { defaultRecruitmentDates } from "@/features/recruitment/utils/recruitment-format";
import { RecruitmentCalendar } from "@/features/recruitment/components/recruitment-calendar";
import { InterviewCandidates } from "@/features/recruitment/components/interview-candidates";
import { RecruitmentEditor } from "@/features/recruitment/components/recruitment-editor";
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
async function option(label: string, name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  const item = await screen.findByRole("option", { name });
  fireEvent.pointerDown(item, { pointerType: "mouse" });
  fireEvent.click(item);
}
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
  const add = await screen.findByRole("button", {
    name: "Thêm ứng viên TEST-REC",
  });
  await waitFor(() => expect(add.hasAttribute("disabled")).toBe(false));
  fireEvent.click(add);
  await screen.findByRole("form", { name: "Thêm ứng viên" });
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
  await option("Quận/Huyện", "Ba Đình");
  fireEvent.change(screen.getByLabelText(/^Địa chỉ/), {
    target: { value: "TEST address" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.recruitmentWrite).toHaveBeenCalledWith(
    "/detail_cv/85",
    "POST",
    expect.any(FormData),
  );
});
it("excludes the current CV status and submits status changes using the correct CV", async () => {
  mount(<RecruitmentList kind="candidates" />);
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
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.recruitmentWrite).toHaveBeenCalledWith(
    "/change_status_cv/408",
    "PUT",
    expect.any(FormData),
  );
});
it("opens duplicate results without writing candidate records", async () => {
  vi.mocked(api.recruitmentObject).mockResolvedValue({ results: [] });
  mount(<RecruitmentList kind="candidates" />);
  const button = await screen.findByRole("button", {
    name: "Kiểm tra trùng TEST-CV",
  });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  fireEvent.click(button);
  await screen.findByText("Không tìm thấy hồ sơ trùng lặp.");
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
});
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
  expect(screen.queryByRole("button", { name: /^Đặt giờ/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Bỏ khỏi lịch/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Sửa hồ sơ/ })).toBeNull();
  expect(api.recruitmentLookups).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Xem hồ sơ TEST Candidate" }),
  );
  await screen.findByLabelText(/^Họ và tên/);
  expect(screen.getByLabelText(/^Họ và tên/).hasAttribute("disabled")).toBe(
    true,
  );
  expect(screen.queryByRole("button", { name: "Lưu" })).toBeNull();
  expect(api.recruitmentWrite).not.toHaveBeenCalled();
});
it("shows live-contract note content and author after reopening a profile", async () => {
  vi.mocked(api.recruitmentArray).mockImplementation(async (path) =>
    path.startsWith("/note-cv/")
      ? [
          {
            id: 1,
            content: "TEST feedback persisted",
            fore_user__username: "test-interviewer",
            data_file: [],
          },
        ]
      : [],
  );
  mount(
    <RecruitmentEditor
      state={{ action: "view-candidate", row: candidate }}
      lookups={{}}
      onClose={vi.fn()}
    />,
  );
  await screen.findByText("TEST feedback persisted");
  expect(screen.getByText(/test-interviewer/)).toBeTruthy();
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
it("keeps an oversized CV error when a separate valid note file is selected", async () => {
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
  fireEvent.change(screen.getByLabelText("Tệp ghi chú phỏng vấn"), {
    target: { files: [new File(["TEST"], "TEST_note.pdf")] },
  });
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
      .getByRole("button", { name: "Sửa hồ sơ TEST-CV" })
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
