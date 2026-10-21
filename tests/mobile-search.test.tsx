// @vitest-environment jsdom
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { MobilePageActionProvider } from "@/components/layout/mobile-page-action";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReportFiltersForm } from "@/features/reports/components/report-filters";
import { listReportTypesRequest } from "@/features/reports/api/reports-api";
import { reportGroupFixtures, reportTypeFixtures } from "./fixtures/reports";
import { DataSearch } from "@/components/data-management/data-search";
import { RecruitmentFilters } from "@/features/recruitment/components/recruitment-filters";
import { InterviewCandidateFilters } from "@/features/recruitment/components/interview-candidate-filters";

vi.mock("@/features/auth/hooks/use-auth-context", () => ({
  useAuthContext: () => ({ userId: 42 }),
}));
vi.mock("@/features/reports/api/reports-api", () => ({
  listReportTypesRequest: vi.fn(),
}));
let mobile = true;
const listeners = new Set<() => void>();
beforeEach(() => {
  vi.mocked(listReportTypesRequest).mockResolvedValue(reportTypeFixtures);
  mobile = true;
  listeners.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(max-width: 639px)" && mobile,
    media: query,
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const open = () =>
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm nâng cao" }));

it("moves configuration search and status into one mobile drawer and applies only on submit", async () => {
  const search = vi.fn();
  render(
    <DataSearch
      label="Tìm người dùng"
      initialValue=""
      filter={{
        label: "Trạng thái",
        searchable: true,
        initialValue: "all",
        allOptionValue: "all",
        options: [
          { value: "all", label: "Tất cả" },
          { value: "true", label: "Kích hoạt" },
        ],
      }}
      onSearch={search}
      actions={<button>Thêm mới</button>}
    />,
  );
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByRole("button", { name: "Thêm mới" })).toBeTruthy();
  open();
  const dialog = screen.getByRole("dialog", { name: "Tìm kiếm nâng cao" });
  fireEvent.change(
    within(dialog).getByRole("textbox", { name: "Tìm người dùng" }),
    { target: { value: " QA " } },
  );
  fireEvent.click(within(dialog).getByRole("combobox", { name: "Trạng thái" }));
  fireEvent.click(await screen.findByRole("option", { name: "Kích hoạt" }));
  expect(search).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() => expect(search).toHaveBeenCalledWith("QA", "true"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("combines request quick search and advanced fields in a single apply without a second drawer", async () => {
  const apply = vi.fn(),
    clear = vi.fn();
  render(
    <DataSearch
      initialValue=""
      onSearch={vi.fn()}
      actions={<button>Lọc nâng cao cũ</button>}
      mobileFilters={{
        fields: [
          { name: "searchAll", label: "Từ khóa", placeholder: "Tìm..." },
          { name: "ticket_code", label: "Mã yêu cầu", placeholder: "Mã..." },
        ],
        initialValues: { searchAll: "", ticket_code: "" },
        activeCount: 0,
        onApply: apply,
        onClear: clear,
      }}
    />,
  );
  expect(screen.queryByRole("button", { name: "Lọc nâng cao cũ" })).toBeNull();
  open();
  fireEvent.change(screen.getByRole("textbox", { name: "Từ khóa" }), {
    target: { value: "TEST" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Mã yêu cầu" }), {
    target: { value: "HR_01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() =>
    expect(apply).toHaveBeenCalledWith({
      searchAll: "TEST",
      ticket_code: "HR_01",
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  open();
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  expect(clear).not.toHaveBeenCalled();
  expect(apply).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it.each(["requests", "candidates", "interviews", "reports"] as const)(
  "keeps all %s recruitment filters inside one mobile panel",
  async (mode) => {
    const apply = vi.fn();
    render(
      <MobilePageActionProvider>
        <PageHeader title="Tuyển dụng" />
        <RecruitmentFilters
          mode={mode}
          values={{ from_date: "2026-10-01", to_date: "2026-10-21" }}
          lookups={{}}
          busy={false}
          onApply={apply}
          onReset={vi.fn()}
          actions={<button>Xuất Excel</button>}
        />
      </MobilePageActionProvider>,
    );
    expect(screen.queryByLabelText("Bộ lọc tuyển dụng")).toBeNull();
    expect(screen.getByRole("button", { name: "Xuất Excel" })).toBeTruthy();
    const header = within(screen.getByRole("banner"));
    expect(header.getByRole("button", { name: "Xuất Excel" })).toBeTruthy();
    expect(
      header.getByRole("button", { name: "Tìm kiếm nâng cao" }),
    ).toBeTruthy();
    open();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Lọc nâng cao" })).toBeNull();
    if (mode === "candidates") {
      fireEvent.change(screen.getByRole("textbox", { name: "Tìm kiếm" }), {
        target: { value: " TEST " },
      });
      fireEvent.change(
        screen.getByRole("textbox", {
          name: "Mã yêu cầu tuyển dụng",
        }),
        { target: { value: "HR01" } },
      );
    }
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    if (mode === "candidates")
      expect(apply.mock.calls[0][0]).toMatchObject({
        search: "TEST",
        ticket_code: "HR01",
        from_date: "2026-10-01",
      });
  },
);

it("discards canceled candidate search drafts and keeps validation errors inside the drawer", async () => {
  const apply = vi.fn();
  render(
    <RecruitmentFilters
      mode="reports"
      values={{ from_date: "2026-10-01", to_date: "2026-10-21" }}
      lookups={{}}
      busy={false}
      onApply={apply}
      onReset={vi.fn()}
    />,
  );
  open();
  fireEvent.change(screen.getByRole("textbox", { name: "Từ ngày" }), {
    target: { value: "30/10/2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Đóng bộ lọc nâng cao" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  open();
  expect(
    (
      screen.getByRole("textbox", {
        name: "Từ ngày",
      }) as HTMLInputElement
    ).value,
  ).toBe("01/10/2026");
});

it("places interview search, status and gender together on mobile", async () => {
  const apply = vi.fn();
  render(
    <InterviewCandidateFilters
      values={{ search: "", gender: "Nam", cv_status: "" }}
      statuses={[]}
      busy={false}
      onApply={apply}
    />,
  );
  expect(screen.queryByRole("textbox")).toBeNull();
  open();
  expect(
    screen.getByRole("combobox", { name: "Giới tính ứng viên" }),
  ).toBeTruthy();
  fireEvent.change(
    screen.getByRole("textbox", { name: "Tìm ứng viên phỏng vấn" }),
    { target: { value: " Linh " } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() =>
    expect(apply).toHaveBeenCalledWith({
      search: "Linh",
      gender: "Nam",
      cv_status: "",
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("switches back to desktop search when the viewport crosses the breakpoint", async () => {
  render(<DataSearch initialValue="TEST" onSearch={vi.fn()} />);
  expect(screen.queryByRole("searchbox")).toBeNull();
  act(() => {
    mobile = false;
    listeners.forEach((listener) => listener());
  });
  expect(screen.getByRole("searchbox")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Tìm kiếm nâng cao" }),
  ).toBeNull();
});

it.each(["dashboard", "export"] as const)(
  "moves the %s report form into mobile advanced search and preserves validation",
  async (mode) => {
    const apply = vi.fn(),
      exportFile = vi.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={client}>
        <ReportFiltersForm
          mode={mode}
          groups={reportGroupFixtures}
          initialValues={{
            startdate: "2026-10-01",
            enddate: "2026-10-21",
            handlinggroup: "3",
            ticket_type_id: "All",
          }}
          loading={false}
          exporting={false}
          onApply={apply}
          onExport={exportFile}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    open();
    const button = screen.getByRole("button", {
      name: mode === "dashboard" ? "Tra cứu" : "Xuất Excel",
    });
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Từ ngày" }), {
      target: { value: "30/10/2026" },
    });
    fireEvent.click(button);
    await screen.findByText("Ngày kết thúc phải từ ngày bắt đầu trở đi.");
    expect(apply).not.toHaveBeenCalled();
    expect(exportFile).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Từ ngày" }), {
      target: { value: "01/10/2026" },
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(mode === "dashboard" ? apply : exportFile).toHaveBeenCalledTimes(
        1,
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    client.clear();
  },
);

it("closes a recruitment drawer when leaving mobile and does not reopen it after rotating back", async () => {
  render(
    <RecruitmentFilters
      mode="candidates"
      values={{ from_date: "2026-10-01", to_date: "2026-10-21" }}
      lookups={{}}
      busy={false}
      onApply={vi.fn()}
      onReset={vi.fn()}
    />,
  );
  open();
  expect(screen.getByRole("dialog")).toBeTruthy();
  act(() => {
    mobile = false;
    listeners.forEach((listener) => listener());
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  act(() => {
    mobile = true;
    listeners.forEach((listener) => listener());
  });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Tìm kiếm nâng cao" }),
  ).toBeTruthy();
});

it("places a lone mobile search beside the page title and keeps its form working", async () => {
  const search = vi.fn();
  render(
    <MobilePageActionProvider>
      <PageHeader title="Danh sách yêu cầu" />
      <main>
        <DataSearch initialValue="" onSearch={search} />
      </main>
    </MobilePageActionProvider>,
  );
  const header = screen.getByRole("banner");
  expect(
    within(header).getByRole("button", { name: "Tìm kiếm nâng cao" }),
  ).toBeTruthy();
  expect(within(screen.getByRole("main")).queryByRole("button")).toBeNull();
  open();
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm kiếm dữ liệu" }), {
    target: { value: "Ứng viên" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() => expect(search).toHaveBeenCalledWith("Ứng viên", "all"));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    within(header).getByRole("button", { name: "Tìm kiếm nâng cao" }),
  ).toBeTruthy();
});

it("places mobile search and other toolbar actions together beside the title", () => {
  render(
    <MobilePageActionProvider>
      <PageHeader title="Ứng viên" />
      <main>
        <DataSearch
          initialValue=""
          onSearch={vi.fn()}
          actions={
            <Button mobileIconOnly>
              <Download aria-hidden="true" />
              Xuất Excel
            </Button>
          }
        />
      </main>
    </MobilePageActionProvider>,
  );
  const header = within(screen.getByRole("banner"));
  expect(
    header.getByRole("button", { name: "Tìm kiếm nâng cao" }),
  ).toBeTruthy();
  expect(within(screen.getByRole("main")).queryByRole("button")).toBeNull();
  const exportButton = header.getByRole("button", { name: "Xuất Excel" });
  expect(exportButton.querySelector("svg")).toBeTruthy();
  expect(exportButton.querySelector(".max-sm\\:sr-only")).toBeTruthy();
});

it("edits calendar navigation as a draft and applies view and date together", async () => {
  const apply = vi.fn();
  render(
    <RecruitmentFilters
      mode="interviews"
      values={{
        from_date: "2026-10-21",
        user_interview: "",
        calendar_view: "week",
      }}
      lookups={{}}
      busy={false}
      onApply={apply}
      onReset={vi.fn()}
    />,
  );
  expect(screen.queryByRole("button", { name: "Khoảng sau" })).toBeNull();
  open();
  fireEvent.click(screen.getByRole("button", { name: "Khoảng sau" }));
  expect(
    (screen.getByRole("textbox", { name: "Ngày xem lịch" }) as HTMLInputElement)
      .value,
  ).toBe("28/10/2026");
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  expect(apply).not.toHaveBeenCalled();
  open();
  expect(
    (screen.getByRole("textbox", { name: "Ngày xem lịch" }) as HTMLInputElement)
      .value,
  ).toBe("21/10/2026");
  fireEvent.click(screen.getByRole("combobox", { name: "Chế độ xem lịch" }));
  const month = await screen.findByRole("option", { name: "Tháng" });
  fireEvent.pointerDown(month, { pointerType: "mouse" });
  fireEvent.click(month);
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: "Chế độ xem lịch" }).textContent,
    ).toContain("Tháng"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Khoảng sau" }));
  expect(
    (screen.getByRole("textbox", { name: "Ngày xem lịch" }) as HTMLInputElement)
      .value,
  ).toBe("21/11/2026");
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() =>
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        from_date: "2026-11-21",
        calendar_view: "month",
      }),
    ),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});
