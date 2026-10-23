// @vitest-environment jsdom
import { expectErrorToast } from "./fixtures/assert-error-toast";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  DataTable,
  DataText,
  DataRowLink,
  DataSearch,
  DataFiltersDrawer,
  DataPagination,
  DataResults,
  DataClientResults,
  countActiveFilters,
  getFilterValues,
  normalizeFilterValues,
  parseListPagination,
  readStringFilters,
  updateListSearchParams,
  formatDataDate,
  formatDataDateTime,
  type DataColumn,
  type DataFilterField,
  type DataListQuery,
} from "@/components/data-management";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
});
afterEach(cleanup);

it("formats history timestamps with seconds in Vietnam time and blanks missing dates", () => {
  expect(formatDataDateTime("2026-10-20T18:04:05Z")).toBe(
    "21/10/2026 01:04:05",
  );
  expect(formatDataDateTime("2026-10-21T00:00:00+07:00")).toBe(
    "21/10/2026 00:00:00",
  );
  for (const value of [undefined, null, "", "invalid"])
    expect(formatDataDateTime(value)).toBe("");
});

it("leaves missing text blank while preserving zero and false display values", () => {
  const view = render(
    <>
      <DataText />
      <DataText text={null} />
      <DataText text="" />
      <DataText text="0" />
      <DataText text="false" />
    </>,
  );
  expect(
    [...view.container.children].map((element) => element.textContent),
  ).toEqual(["", "", "", "0", "false"]);
  expect(screen.queryByText("—")).toBeNull();
});

// A different domain verifies that shared components do not depend on ticket fields or APIs.
interface Employee {
  code: string;
  name: string;
  office: string;
}
const employee: Employee = { code: "E-01", name: "Nguyễn An", office: "Huế" };
const fields = [
  { name: "name", label: "Nhân viên", placeholder: "Nhập tên nhân viên" },
  {
    name: "joined",
    label: "Ngày gia nhập",
    placeholder: "DD/MM/YYYY",
    type: "date",
  },
] as const satisfies readonly DataFilterField[];
const pagination = {
  page: 1,
  pageSize: 20,
  pageSizes: [20, 40],
  onPage: vi.fn(),
  onPageSize: vi.fn(),
};

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderEmployees(
  getRowHref?: (row: Employee) => string,
  onAction = vi.fn(),
) {
  const columns: DataColumn<Employee>[] = [
    {
      id: "name",
      label: "Nhân viên",
      width: "60%",
      render: (row) => <DataText text={row.name} />,
    },
    {
      id: "office",
      label: "Văn phòng",
      align: "center",
      render: (row) => <DataText text={row.office} />,
    },
    {
      id: "action",
      label: "Thao tác",
      align: "right",
      render: () => <button onClick={onAction}>Chỉnh sửa</button>,
    },
    {
      id: "link",
      label: "Hồ sơ",
      render: (row) => (
        <DataRowLink to={`/employees/${row.code}`} text="Xem hồ sơ" />
      ),
    },
  ];
  return render(
    <MemoryRouter initialEntries={["/employees"]}>
      <DataTable
        rows={[employee]}
        columns={columns}
        label="Nhân viên"
        scrollLabel="Cuộn nhân viên"
        getRowKey={(row) => row.code}
        getRowHref={getRowHref}
      />
      <Location />
    </MemoryRouter>,
  );
}

it("renders configured columns, matching alignment, two-line text and browser tooltips for another dataset", () => {
  renderEmployees();
  const table = screen.getByRole("table", { name: "Nhân viên" });
  expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
  const header = within(table).getByRole("columnheader", { name: "Văn phòng" });
  const cell = screen.getByText("Huế");
  expect(header.classList.contains("text-center")).toBe(true);
  expect(cell.closest("td")?.classList.contains("text-center")).toBe(true);
  expect(screen.getByText("Nguyễn An").getAttribute("title")).toBe("Nguyễn An");
  expect(screen.getByText("Nguyễn An").classList.contains("line-clamp-2")).toBe(
    true,
  );
  expect(cell.closest("tr")?.getAttribute("tabindex")).toBeNull();
  expect(screen.getByRole("region", { name: "Cuộn nhân viên" })).toBeTruthy();
});

it("keeps modifier clicks and nested actions independent from row navigation", () => {
  const onAction = vi.fn();
  renderEmployees((row) => `/employees/${row.code}`, onAction);
  const cell = screen.getByText("Huế");
  for (const options of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ]) {
    fireEvent.click(cell, options);
    expect(screen.getByTestId("location").textContent).toBe("/employees");
  }
  const action = screen.getByRole("button", { name: "Chỉnh sửa" });
  fireEvent.click(action);
  fireEvent.keyDown(action, { key: "Enter" });
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("location").textContent).toBe("/employees");
  fireEvent.keyDown(cell.closest("tr")!, { key: "Escape" });
  expect(screen.getByTestId("location").textContent).toBe("/employees");
  fireEvent.keyDown(cell.closest("tr")!, { key: "Enter" });
  expect(screen.getByTestId("location").textContent).toBe("/employees/E-01");
});

it("supports ordinary row clicks and direct detail links", () => {
  renderEmployees((row) => `/employees/${row.code}`);
  fireEvent.click(screen.getByText("Huế"));
  expect(screen.getByTestId("location").textContent).toBe("/employees/E-01");
  fireEvent.click(screen.getByRole("link", { name: "Xem hồ sơ" }));
  expect(screen.getByTestId("location").textContent).toBe("/employees/E-01");
});

it("resets only vertical scroll when the configured list key changes, preserving the mounted table and same-key updates", () => {
  const props = {
    rows: [employee],
    columns: [
      {
        id: "name",
        label: "Nhân viên",
        render: (row: Employee) => <DataText text={row.name} />,
      },
    ],
    label: "Nhân viên",
    scrollLabel: "Cuộn nhân viên",
    getRowKey: (row: Employee) => row.code,
  };
  const { rerender } = render(
    <MemoryRouter>
      <DataTable {...props} scrollResetKey="page-1" />
    </MemoryRouter>,
  );
  const region = screen.getByRole("region", { name: "Cuộn nhân viên" });
  const table = screen.getByRole("table");
  region.scrollTop = 500;
  region.scrollLeft = 160;
  rerender(
    <MemoryRouter>
      <DataTable
        {...props}
        rows={[{ ...employee, name: "Updated employee" }]}
        scrollResetKey="page-1"
      />
    </MemoryRouter>,
  );
  expect(region.scrollTop).toBe(500);
  rerender(
    <MemoryRouter>
      <DataTable {...props} scrollResetKey="page-2" />
    </MemoryRouter>,
  );
  expect(screen.getByRole("table")).toBe(table);
  expect(screen.getByRole("region", { name: "Cuộn nhân viên" })).toBe(region);
  expect(region.scrollTop).toBe(0);
  expect(region.scrollLeft).toBe(160);
});

it("supports search without a select and applies draft values only on submit", () => {
  const onSearch = vi.fn();
  render(
    <DataSearch label="Tìm nhân viên" initialValue="" onSearch={onSearch} />,
  );
  const input = screen.getByRole("searchbox", { name: "Tìm nhân viên" });
  fireEvent.change(input, { target: { value: "  Nguyễn An  " } });
  expect(onSearch).not.toHaveBeenCalled();
  expect(screen.queryByRole("combobox")).toBeNull();
  fireEvent.submit(screen.getByRole("search", { name: "Tìm nhân viên" }));
  expect(onSearch).toHaveBeenCalledWith("Nguyễn An", "");
});

it("counts only configured applied filters and validates dates before applying the reusable drawer", async () => {
  const onApply = vi.fn();
  render(
    <DataFiltersDrawer
      fields={fields}
      initialValues={{ name: " An ", joined: " " }}
      onApply={onApply}
      onClear={vi.fn()}
    />,
  );
  const trigger = screen.getByRole("button", { name: "Lọc nâng cao" });
  expect(trigger.getAttribute("aria-description")).toBe(
    "1 điều kiện lọc nâng cao đang áp dụng",
  );
  expect(within(trigger).getByText("1")).toBeTruthy();
  fireEvent.click(trigger);
  await screen.findByRole("dialog", { name: "Lọc nâng cao" });
  expect(screen.getByPlaceholderText("Nhập tên nhân viên")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Ngày gia nhập"), {
    target: { value: "1/" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
  await screen.findByText("Enter a valid date (DD/MM/YYYY).");
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Ngày gia nhập"), {
    target: { value: "20/11/2027" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
  await waitFor(() =>
    expect(onApply).toHaveBeenCalledWith({ name: "An", joined: "2027-11-20" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("supports multiple independent pagers and configurable page sizes without duplicate control IDs", () => {
  render(
    <>
      <DataPagination {...pagination} count={65} itemLabel="nhân viên" />
      <DataPagination {...pagination} count={30} />
    </>,
  );
  const sizeControls = screen.getAllByRole("combobox");
  const ids = sizeControls.map((control) => control.id);
  expect(new Set(ids).size).toBe(2);
  expect(screen.getByText("Hiển thị 1–20 trên 65 nhân viên")).toBeTruthy();
  const nav = screen.getByRole("navigation", { name: "Phân trang nhân viên" });
  fireEvent.click(within(nav).getByRole("button", { name: "Trang sau" }));
  expect(pagination.onPage).toHaveBeenCalledWith(2);
});

it("shows the current page in a jump input and navigates with previous and next buttons", () => {
  const onPage = vi.fn();
  render(
    <DataPagination {...pagination} page={2} count={65} onPage={onPage} />,
  );
  expect(
    (screen.getByRole("spinbutton", { name: "Đến trang" }) as HTMLInputElement)
      .value,
  ).toBe("2");
  expect(screen.getByText("/ 4")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Chọn trang" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Đến trang" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Trang trước" }));
  expect(onPage).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  expect(onPage).toHaveBeenCalledWith(3);
});

it("jumps only on Enter and resets the draft when navigation or page size changes", () => {
  const onPage = vi.fn();
  const { rerender } = render(
    <DataPagination {...pagination} count={125} onPage={onPage} />,
  );
  const input = screen.getByRole("spinbutton", { name: "Đến trang" });
  fireEvent.change(input, { target: { value: "5" } });
  expect(onPage).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onPage).toHaveBeenCalledExactlyOnceWith(5);
  rerender(
    <DataPagination {...pagination} page={5} count={125} onPage={onPage} />,
  );
  const current = screen.getByRole("spinbutton", {
    name: "Đến trang",
  }) as HTMLInputElement;
  expect(current.value).toBe("5");
  fireEvent.change(current, { target: { value: "6" } });
  fireEvent.blur(current);
  expect(current.value).toBe("5");
  rerender(
    <DataPagination
      {...pagination}
      page={1}
      pageSize={40}
      count={125}
      onPage={onPage}
    />,
  );
  expect(
    (screen.getByRole("spinbutton", { name: "Đến trang" }) as HTMLInputElement)
      .value,
  ).toBe("1");
  expect(screen.getByText("/ 4")).toBeTruthy();
});

it.each(["", "1.5", "2"])(
  "rejects invalid or unchanged jump page %s",
  (value) => {
    const onPage = vi.fn();
    render(
      <DataPagination {...pagination} page={2} count={65} onPage={onPage} />,
    );
    const input = screen.getByRole("spinbutton", { name: "Đến trang" });
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPage).not.toHaveBeenCalled();
  },
);

it.each([
  ["0", 1],
  ["-1", 1],
  ["5", 4],
  ["145", 4],
] as const)(
  "clamps jump page %s to the available page %s",
  (value, expected) => {
    const onPage = vi.fn();
    render(
      <DataPagination {...pagination} page={2} count={65} onPage={onPage} />,
    );
    const input = screen.getByRole("spinbutton", {
      name: "Đến trang",
    }) as HTMLInputElement;
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPage).toHaveBeenCalledExactlyOnceWith(expected);
    expect(input.value).toBe(String(expected));
    expect(input.validity.valid).toBe(true);
  },
);

it("restores the last page without refetching when an excessive page is entered there", () => {
  const onPage = vi.fn();
  render(
    <DataPagination {...pagination} page={144} count={2880} onPage={onPage} />,
  );
  const input = screen.getByRole("spinbutton", {
    name: "Đến trang",
  }) as HTMLInputElement;
  fireEvent.change(input, { target: { value: "145" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input.value).toBe("144");
  expect(input.validity.valid).toBe(true);
  expect(onPage).not.toHaveBeenCalled();
});

it("resets search drafts without remounting the filter drawer action", async () => {
  const actions = (
    <DataFiltersDrawer
      fields={fields}
      initialValues={{}}
      onApply={vi.fn()}
      onClear={vi.fn()}
    />
  );
  const props = {
    initialValue: "before",
    resetKey: "before",
    actions,
    onSearch: vi.fn(),
  };
  const { rerender } = render(<DataSearch {...props} />);
  const trigger = screen.getByRole("button", { name: "Lọc nâng cao" });
  fireEvent.click(trigger);
  const drawer = await screen.findByRole("dialog", { name: "Lọc nâng cao" });
  rerender(<DataSearch {...props} initialValue="after" resetKey="after" />);
  expect(screen.getByRole("dialog", { name: "Lọc nâng cao" })).toBe(drawer);
  fireEvent.click(
    within(drawer).getByRole("button", { name: "Đóng bộ lọc nâng cao" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
    "after",
  );
  expect(document.activeElement).toBe(trigger);
});

it("hides empty pagination and disables every paging control during updates", () => {
  const { rerender } = render(<DataPagination {...pagination} count={0} />);
  expect(screen.queryByRole("navigation")).toBeNull();
  rerender(<DataPagination {...pagination} count={65} disabled />);
  for (const control of screen.getAllByRole("button"))
    expect(control.hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("combobox").hasAttribute("disabled")).toBe(true);
  const input = screen.getByRole("spinbutton", { name: "Đến trang" });
  expect(input.hasAttribute("disabled")).toBe(true);
  fireEvent.change(input, { target: { value: "3" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(pagination.onPage).not.toHaveBeenCalled();
});

const readyQuery: DataListQuery<Employee> = {
  data: { count: 65, results: [employee] },
  error: null,
  isPending: false,
  isError: false,
  isFetching: false,
  isPlaceholderData: false,
  refetch: vi.fn(),
};
const renderRows = (rows: Employee[]) => (
  <div data-testid="rows">{rows.map((row) => row.name).join(", ")}</div>
);

it("keeps previous rows mounted under a loading overlay and hides pagination for empty results", () => {
  const props = { label: "Kết quả nhân viên", pagination, renderRows };
  const { rerender } = render(
    <DataResults
      {...props}
      query={{
        ...readyQuery,
        data: undefined,
        isPending: true,
        isFetching: true,
      }}
    />,
  );
  expect(screen.getByText("Đang tải danh sách...")).toBeTruthy();
  rerender(<DataResults {...props} query={readyQuery} />);
  const rows = screen.getByTestId("rows");
  rerender(
    <DataResults
      {...props}
      query={{ ...readyQuery, isFetching: true, isPlaceholderData: true }}
    />,
  );
  expect(screen.getByTestId("rows")).toBe(rows);
  expect(
    screen
      .getByText("Đang cập nhật danh sách...")
      .closest('[role="status"]')
      ?.classList.contains("absolute"),
  ).toBe(true);
  expect(
    screen.getByRole("region", { name: props.label }).getAttribute("aria-busy"),
  ).toBe("true");
  rerender(
    <DataResults
      {...props}
      query={{ ...readyQuery, data: { count: 0, results: [] } }}
    />,
  );
  expect(screen.getByText("Không tìm thấy dữ liệu")).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(screen.queryByTestId("rows")).toBeNull();
});

it("keeps rows mounted without a full overlay during subtle refreshes and background failures", async () => {
  const props = {
    label: "Kết quả nhân viên",
    pagination,
    renderRows,
    refreshStyle: "subtle" as const,
  };
  const view = render(<DataResults {...props} query={readyQuery} />);
  const rows = screen.getByTestId("rows");
  rows.scrollTop = 150;
  view.rerender(
    <DataResults {...props} query={{ ...readyQuery, isFetching: true }} />,
  );
  expect(screen.getByTestId("rows")).toBe(rows);
  const indicator = screen
    .getByText("Đang cập nhật danh sách...")
    .closest('[role="status"]');
  expect(indicator?.classList.contains("h-0.5")).toBe(true);
  expect(indicator?.classList.contains("inset-0")).toBe(false);
  view.rerender(
    <DataResults
      {...props}
      query={{ ...readyQuery, isError: true, error: new Error("TEST offline") }}
    />,
  );
  expect(screen.getByTestId("rows")).toBe(rows);
  expect(rows.scrollTop).toBe(150);
  await expectErrorToast("Không tải được danh sách: TEST offline");
  view.rerender(<DataResults {...props} query={readyQuery} />);
  expect(screen.getByTestId("rows")).toBe(rows);
});

it("provides shared error recovery without depending on a query library or feature DTO", async () => {
  render(
    <DataResults
      label="Kết quả nhân viên"
      pagination={{ ...pagination, page: 2 }}
      renderRows={renderRows}
      query={{
        ...readyQuery,
        data: undefined,
        isError: true,
        error: new Error("Offline"),
      }}
    />,
  );
  await expectErrorToast("Không tải được danh sách: Offline");
  expect(screen.queryByRole("button", { name: /^Thử lại/ })).toBeNull();
  expect(readyQuery.refetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Về trang đầu" }));
  expect(pagination.onPage).toHaveBeenCalledWith(1);
});

it.each(["-1", "0", "abc", "1.2", "Infinity", "9007199254740992"])(
  "rejects invalid list page %s with configurable sizes",
  (page) => {
    expect(
      parseListPagination(
        new URLSearchParams({ page, page_size: "500" }),
        [20, 40],
      ),
    ).toEqual({ page: 1, pageSize: 20 });
  },
);

it("parses allowed pagination and only whitelisted nonempty string filters", () => {
  const search = new URLSearchParams(
    "page=3&page_size=40&name=%20An%20&joined=%20&other=ignored",
  );
  expect(parseListPagination(search, [20, 40])).toEqual({
    page: 3,
    pageSize: 40,
  });
  expect(readStringFilters(search, ["name", "joined"])).toEqual({ name: "An" });
  expect(getFilterValues(fields, {})).toEqual({ name: "", joined: "" });
  expect(countActiveFilters(fields, { name: " ", joined: "2027-01-01" })).toBe(
    1,
  );
});

it("normalizes configured date fields without hardcoding a ticket-specific field name", () => {
  expect(
    normalizeFilterValues(fields, { name: "  An  ", joined: "2/3/2027" }),
  ).toEqual({ name: "An", joined: "2027-03-02" });
  expect(normalizeFilterValues(fields, { joined: "2027-03-02" })).toEqual({
    name: "",
    joined: "2027-03-02",
  });
  expect(normalizeFilterValues(fields, { joined: "31/02/2027" })).toEqual({
    name: "",
    joined: "",
  });
  expect(normalizeFilterValues(fields, {})).toEqual({ name: "", joined: "" });
});

it("updates URL filters immutably, removes empty values, resets paging and preserves unrelated parameters", () => {
  const current = new URLSearchParams(
    "page=3&page_size=40&name=old&joined=old&tab=staff&columnSort=name",
  );
  const next = updateListSearchParams(
    current,
    { name: " An ", joined: undefined, query: " " },
    ["columnSort"],
  );
  expect(Object.fromEntries(next)).toEqual({
    page: "1",
    page_size: "40",
    name: "An",
    tab: "staff",
  });
  expect(current.get("page")).toBe("3");
  expect(current.get("name")).toBe("old");
  expect(updateListSearchParams(next, { page: 2 }).get("page")).toBe("2");
});

it("formats API dates consistently, including timestamps crossing the local midnight boundary", () => {
  expect(formatDataDate("2026-10-20T18:00:00Z")).toBe("21/10/2026");
  expect(formatDataDate("2026-10-21")).toBe("21/10/2026");
  for (const value of [undefined, null, "", "invalid"])
    expect(formatDataDate(value)).toBe("");
});

it("paginates complete API results with shared controls and clamps after deletion", async () => {
  const rows = Array.from({ length: 201 }, (_, index) => ({ id: index + 1 }));
  const query = {
    data: { count: rows.length, results: rows },
    error: null,
    isPending: false,
    isError: false,
    isFetching: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  };
  const props = {
    label: "Kết quả thử",
    itemLabel: "bản ghi",
    query,
    renderRows: (visible: { id: number }[], offset: number) => (
      <div aria-label="Dòng hiển thị" data-offset={offset}>
        {visible.map((row) => (
          <p key={row.id}>Dòng {row.id}</p>
        ))}
      </div>
    ),
  };
  const view = render(<DataClientResults {...props} />);
  expect(screen.getByText("Dòng 100")).toBeTruthy();
  expect(screen.queryByText("Dòng 101")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  expect(screen.getByText("Dòng 101")).toBeTruthy();
  expect(screen.queryByText("Dòng 1")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  expect(screen.getByText("Dòng 201")).toBeTruthy();
  view.rerender(
    <DataClientResults
      {...props}
      query={{ ...query, data: { count: 100, results: rows.slice(0, 100) } }}
    />,
  );
  expect(screen.getByText("Dòng 1")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Trang sau" }).hasAttribute("disabled"),
  ).toBe(true);
  view.rerender(
    <DataClientResults {...props} query={{ ...query, isFetching: true }} />,
  );
  expect(
    screen.getByRole("button", { name: "Trang sau" }).hasAttribute("disabled"),
  ).toBe(true);
});

it("resets client pagination when page size changes and on a new result scope", async () => {
  const rows = Array.from({ length: 201 }, (_, index) => ({ id: index + 1 }));
  const props = {
    query: {
      data: { count: rows.length, results: rows },
      error: null,
      isPending: false,
      isError: false,
      isFetching: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    },
    label: "Kết quả thử",
    itemLabel: "bản ghi",
    renderRows: (visible: { id: number }[]) => (
      <div>
        {visible.map((row) => (
          <p key={row.id}>Dòng {row.id}</p>
        ))}
      </div>
    ),
  };
  const view = render(<DataClientResults scopeKey="first" {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  fireEvent.click(
    screen.getByRole("combobox", { name: "Số bản ghi mỗi trang" }),
  );
  const sizeOption = await screen.findByRole("option", { name: "200 / trang" });
  fireEvent.pointerDown(sizeOption, { pointerType: "mouse" });
  fireEvent.click(sizeOption);
  expect(screen.getByText("Dòng 1")).toBeTruthy();
  expect(screen.getByText("Dòng 200")).toBeTruthy();
  expect(screen.queryByText("Dòng 201")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  view.rerender(<DataClientResults scopeKey="second" {...props} />);
  expect(screen.getByText("Dòng 1")).toBeTruthy();
  expect(screen.getByText("Dòng 200")).toBeTruthy();
  expect(screen.queryByText("Dòng 201")).toBeNull();
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
