// @vitest-environment jsdom
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SearchableSelect } from "@/components/ui/searchable-select";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const options = [
  { value: "All", label: "Tất cả loại yêu cầu" },
  { value: "17", label: "Thiết bị" },
  { value: "18", label: "Phần mềm" },
];
function Example({ items = options }: Readonly<{ items?: typeof options }>) {
  const [value, setValue] = useState("All");
  return (
    <SearchableSelect
      id="types"
      label="Loại yêu cầu"
      options={items}
      value={value}
      onValueChange={setValue}
      allOptionValue="All"
    />
  );
}
async function openSelect(items = options) {
  render(<Example items={items} />);
  fireEvent.click(screen.getByRole("combobox", { name: "Loại yêu cầu" }));
  await screen.findByRole("option", { name: "Thiết bị" });
  vi.useFakeTimers();
  return screen.getByRole("combobox", { name: "Tìm loại yêu cầu" });
}
function type(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}
function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}
it("updates the input immediately but filters only after 300ms without requiring Enter", async () => {
  const input = await openSelect();
  type(input, " THIET BI ");
  expect((input as HTMLInputElement).value).toBe(" THIET BI ");
  advance(299);
  expect(screen.getAllByRole("option")).toHaveLength(3);
  advance(1);
  expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(
    screen
      .getByRole("option", { name: "Thiết bị" })
      .querySelector(".lucide-check"),
  ).not.toBeNull();
});
it("shows a disabled option but prevents selecting it", () => {
  const onValueChange = vi.fn();
  render(
    <SearchableSelect
      id="assignment"
      label="Loại phân công"
      value="add"
      options={[
        { value: "add", label: "Thêm người xử lý" },
        { value: "delete", label: "Xóa người xử lý", disabled: true },
      ]}
      onValueChange={onValueChange}
    />,
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Loại phân công" }));
  const disabled = screen.getByRole("option", { name: "Xóa người xử lý" });
  expect(disabled.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(disabled);
  expect(onValueChange).not.toHaveBeenCalled();
});
it("cancels earlier searches and applies the latest text after another 300ms", async () => {
  const input = await openSelect();
  type(input, "phan");
  advance(200);
  type(input, "thiet");
  advance(299);
  expect(screen.getAllByRole("option")).toHaveLength(3);
  advance(1);
  expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(screen.getByRole("option", { name: "Thiết bị" })).toBeTruthy();
  advance(1000);
  expect(screen.queryByRole("option", { name: "Phần mềm" })).toBeNull();
});
it("debounces clearing the query and shows the full list again", async () => {
  const input = await openSelect();
  type(input, "phan mem");
  advance(300);
  expect(screen.getAllByRole("option")).toHaveLength(1);
  type(input, "");
  advance(299);
  expect(screen.getAllByRole("option")).toHaveLength(1);
  advance(1);
  expect(screen.getAllByRole("option")).toHaveLength(3);
});
it("resets results immediately when reopening and never reuses a pending search from the previous session", async () => {
  let input = await openSelect();
  type(input, "phan");
  advance(300);
  expect(screen.getAllByRole("option")).toHaveLength(1);
  type(input, "no match");
  advance(50);
  fireEvent.keyDown(input, { key: "Escape" });
  advance(50);
  fireEvent.click(screen.getByRole("combobox", { name: "Loại yêu cầu" }));
  input = screen.getByRole("combobox", { name: "Tìm loại yêu cầu" });
  expect((input as HTMLInputElement).value).toBe("");
  expect(screen.getAllByRole("option")).toHaveLength(3);
  type(input, "thiet");
  advance(299);
  expect(screen.getAllByRole("option")).toHaveLength(3);
  advance(1);
  expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(screen.getByRole("option", { name: "Thiết bị" })).toBeTruthy();
});
it("filters during Vietnamese IME composition without waiting for a space or composition end", async () => {
  const input = await openSelect();
  fireEvent.compositionStart(input);
  type(input, "Thiế");
  advance(299);
  expect(screen.getAllByRole("option")).toHaveLength(3);
  advance(1);
  expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(screen.getByRole("option", { name: "Thiết bị" })).toBeTruthy();
  type(input, "Phần");
  advance(300);
  expect(screen.getByRole("option", { name: "Phần mềm" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Thiết bị" })).toBeNull();
  expect((input as HTMLInputElement).value).toBe("Phần");
  fireEvent.compositionEnd(input);
  advance(300);
  expect(screen.getAllByRole("option")).toHaveLength(1);
  fireEvent.click(screen.getByRole("option", { name: "Phần mềm" }));
  expect(
    screen.getByRole("combobox", { name: "Loại yêu cầu" }).textContent,
  ).toContain("Phần mềm");
});
it.each(["dang ky", "ĐĂNG KÝ", "đăng ký", "  DANG KY  "])(
  "matches Vietnamese accents and đ regardless of case for %s",
  async (query) => {
    const input = await openSelect([
      ...options,
      { value: "19", label: "Đăng ký làm việc từ xa" },
    ]);
    type(input, query);
    advance(300);
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(
      screen.getByRole("option", { name: "Đăng ký làm việc từ xa" }),
    ).toBeTruthy();
  },
);
