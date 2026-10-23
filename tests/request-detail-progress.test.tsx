// @vitest-environment jsdom
import { useRef } from "react";
import { hrTerminationTemplate } from "./fixtures/create-request";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useFieldArray, useForm } from "react-hook-form";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RequestDetailProgress } from "@/features/requests/components/request-detail-progress";
import { RequestDetailField } from "@/features/requests/components/request-detail-field";
import type { CreateRequestValues } from "@/features/requests/schemas/create-request-schema";
import {
  detailFields,
  emptyDetailRow,
} from "@/features/requests/utils/request-detail-data";
import type { TemplateGroup } from "@/features/settings/schemas/template-schema";

const groups: TemplateGroup[] = [
  {
    title: "Thông tin",
    children: [
      { title: "Tên", type: "text", required: true },
      { title: "Số lượng", type: "number", required: true },
      { title: "Bàn giao", type: "range-date-text", required: true },
      { title: "Ghi chú", type: "text" },
    ],
  },
];
const scroll = vi.fn();
const submit = vi.fn();
let viewportWidth = 400;
const resizeCallbacks: Array<() => void> = [];

function Harness({
  disabled = false,
  template = groups,
}: {
  disabled?: boolean;
  template?: TemplateGroup[];
}) {
  const form = useForm<CreateRequestValues>({
    defaultValues: { rows: [emptyDetailRow(template)] },
  });
  const rows = useFieldArray({ control: form.control, name: "rows" });
  const fields = detailFields(template);
  const scrollContainer = useRef<HTMLDivElement>(null);
  return (
    <form onSubmit={submit}>
      <RequestDetailProgress
        form={form}
        fields={fields}
        disabled={disabled}
        scrollContainer={scrollContainer}
      />
      <div ref={scrollContainer}>
        <div />
      </div>
      {rows.fields.map((row, index) => (
        <div key={row.id}>
          {fields.map((field) => (
            <RequestDetailField
              key={field.fieldKey}
              form={form}
              fields={fields}
              field={field}
              row={index}
              disabled={disabled}
            />
          ))}
          <button type="button" onClick={() => rows.remove(index)}>
            Xóa dòng {index + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => rows.append(emptyDetailRow(template))}
      >
        Thêm dòng
      </button>
    </form>
  );
}

beforeEach(() => {
  viewportWidth = 400;
  resizeCallbacks.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function (callback: () => void) {
      resizeCallbacks.push(callback);
      return { observe: vi.fn(), disconnect: vi.fn() };
    }),
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    () => viewportWidth,
  );
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(800);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scroll,
  });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

it("reveals missing inputs and counts both ends of a required date range without submitting", () => {
  render(<Harness />);
  expect(screen.getByText(/Đã nhập 0\/4 ô bắt buộc/)).toBeTruthy();
  const next = () =>
    fireEvent.click(screen.getByRole("button", { name: "Đến ô chưa nhập" }));
  next();
  expect(document.activeElement).toBe(screen.getByLabelText(/Tên/));
  expect(scroll).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
  fireEvent.change(screen.getByLabelText(/Tên/), { target: { value: "   " } });
  expect(screen.getByText(/Còn 4 ô chưa nhập/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Tên/), { target: { value: "An" } });
  fireEvent.change(screen.getByLabelText(/Số lượng/), {
    target: { value: "0" },
  });
  expect(screen.getByText(/Đã nhập 2\/4 ô bắt buộc/)).toBeTruthy();
  next();
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: /Bàn giao - Từ ngày/ }),
  );
  fireEvent.change(document.activeElement!, {
    target: { value: "23/10/2026" },
  });
  expect(screen.getByText(/Còn 1 ô chưa nhập/)).toBeTruthy();
  next();
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: /Bàn giao - Đến ngày/ }),
  );
  fireEvent.change(document.activeElement!, {
    target: { value: "24/10/2026" },
  });
  expect(screen.queryByText(/ô bắt buộc/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Đến ô chưa nhập" })).toBeNull();
  fireEvent.change(screen.getByLabelText(/Tên/), { target: { value: "" } });
  expect(screen.getByText(/Còn 1 ô chưa nhập/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Đến ô chưa nhập" })).toBeTruthy();
  expect(submit).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("updates totals when rows are added and removed", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Thêm dòng" }));
  expect(screen.getByText(/Còn 8 ô chưa nhập/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Xóa dòng 1" }));
  expect(screen.getByText(/Còn 4 ô chưa nhập/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Đến ô chưa nhập" }));
  expect(document.activeElement?.id).toBe("detail-0-f0");
});

it("disables navigation while saving and omits progress when there are no required fields", () => {
  const { rerender } = render(<Harness disabled />);
  expect(
    (
      screen.getByRole("button", {
        name: "Đến ô chưa nhập",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  rerender(
    <Harness
      template={[
        { title: "Ghi chú", children: [{ title: "Ghi chú", type: "text" }] },
      ]}
    />,
  );
  expect(screen.queryByText(/ô bắt buộc/)).toBeNull();
});

it("only shows the reminder when details overflow horizontally and reacts to resizing", () => {
  viewportWidth = 800;
  render(<Harness />);
  expect(screen.queryByRole("button", { name: "Đến ô chưa nhập" })).toBeNull();
  act(() => {
    viewportWidth = 400;
    resizeCallbacks.forEach((callback) => callback());
  });
  expect(screen.getByText(/Còn 4 ô chưa nhập/)).toBeTruthy();
  act(() => {
    viewportWidth = 1000;
    resizeCallbacks.forEach((callback) => callback());
  });
  expect(screen.queryByText(/ô bắt buộc/)).toBeNull();
});

it("keeps the same resize observer while typing and when the parent rerenders", () => {
  const { rerender } = render(<Harness />);
  const observers = vi.mocked(ResizeObserver).mock.calls.length;
  fireEvent.change(screen.getByLabelText(/Tên/), { target: { value: "TEST" } });
  rerender(<Harness disabled />);
  expect(vi.mocked(ResizeObserver).mock.calls.length).toBe(observers);
});

it("counts missing HR handover endpoints separately and updates after replacing rows", () => {
  render(<Harness template={hrTerminationTemplate} />);
  expect(screen.getByText(/Còn 10 ô chưa nhập/)).toBeTruthy();
  fireEvent.change(
    screen.getByRole("textbox", {
      name: /Thời gian Bàn giao công việc - Từ ngày/,
    }),
    { target: { value: "26/10/2026" } },
  );
  expect(screen.getByText(/Còn 9 ô chưa nhập/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Thêm dòng" }));
  expect(screen.getByText(/Còn 19 ô chưa nhập/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Xóa dòng 1" }));
  expect(screen.getByText(/Còn 10 ô chưa nhập/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Đến ô chưa nhập" }));
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: /Mã số Nhân viên/ }),
  );
});
