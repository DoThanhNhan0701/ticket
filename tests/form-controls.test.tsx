// @vitest-environment jsdom
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SearchInput } from "@/components/search-input";
import { MultiSelectField } from "@/components/form/multi-select-field";
import { DatePickerField } from "@/components/form/date-picker-field";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
});
afterEach(cleanup);

function SearchExample() {
  const [value, setValue] = useState("alice");
  return (
    <SearchInput label="Search users" value={value} onValueChange={setValue} />
  );
}

it("returns keyboard focus to search after clearing its value", () => {
  render(<SearchExample />);
  const search = screen.getByRole("searchbox", { name: "Search users" });
  fireEvent.click(screen.getByRole("button", { name: "Xóa search users" }));
  expect((search as HTMLInputElement).value).toBe("");
  expect(document.activeElement).toBe(search);
});

function DialogExample({
  onOpenChange,
}: Readonly<{ onOpenChange: (open: boolean) => void }>) {
  const { control } = useForm({ defaultValues: { categories: [] } });
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Access settings</DialogTitle>
        <MultiSelectField
          control={control}
          name="categories"
          id="categories"
          label="Categories"
          options={Array.from({ length: 6 }, (_, index) => ({
            value: String(index),
            label: `System ${index}`,
          }))}
        />
      </DialogContent>
    </Dialog>
  );
}

it("Escape closes the category popover while keeping its parent form open", async () => {
  const onOpenChange = vi.fn();
  render(<DialogExample onOpenChange={onOpenChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Categories" }));
  const search = await screen.findByRole("searchbox", {
    name: "Search categories",
  });
  fireEvent.keyDown(search, { key: "Escape", code: "Escape" });
  await waitFor(() =>
    expect(
      screen.queryByRole("searchbox", { name: "Search categories" }),
    ).toBeNull(),
  );
  expect(screen.getByRole("dialog", { name: "Access settings" })).toBeTruthy();
  expect(onOpenChange.mock.calls.some(([open]) => open === false)).toBe(false);
});

function BirthdayForm({
  birthday = "",
  required = true,
  isDateDisabled,
  disabled,
  onSubmit,
}: Readonly<{
  birthday?: string;
  required?: boolean;
  isDateDisabled?: (date: Date) => boolean;
  disabled?: boolean;
  onSubmit: (birthday: string) => void;
}>) {
  const { control, handleSubmit, reset } = useForm({
    defaultValues: { birthday },
  });
  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values.birthday))}>
      <DatePickerField
        control={control}
        name="birthday"
        id="birthday"
        label="Date of Birth"
        required={required}
        isDateDisabled={isDateDisabled}
        disabled={disabled}
      />
      <button type="submit">Save</button>
      <button type="button" onClick={() => reset()}>
        Reset
      </button>
    </form>
  );
}

it("accepts manual dates, normalizes on blur, and resets to an ISO birthday", async () => {
  const onSubmit = vi.fn();
  render(<BirthdayForm birthday="2000-03-02" onSubmit={onSubmit} />);
  const input = screen.getByRole("textbox", { name: "Date of Birth" });
  expect((input as HTMLInputElement).value).toBe("02/03/2000");
  fireEvent.change(input, { target: { value: "29/02/" } });
  expect((input as HTMLInputElement).value).toBe("29/02/");
  fireEvent.change(input, { target: { value: "29/2/2024" } });
  fireEvent.blur(input);
  expect((input as HTMLInputElement).value).toBe("29/02/2024");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("29/02/2024"));
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect((input as HTMLInputElement).value).toBe("02/03/2000");
});

it.each([
  "22/13/2026",
  "32/12/2026",
  "00/12/2026",
  "22/00/2026",
  "31/04/2026",
  "31/02/2026",
  "29/02/2025",
  "22/12/20266",
  "abc",
])(
  "blocks invalid typed or pasted dates before changing the value: %s",
  (birthday) => {
    render(<BirthdayForm birthday="2000-03-02" onSubmit={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "Date of Birth" });
    fireEvent.change(input, { target: { value: birthday } });
    expect((input as HTMLInputElement).value).toBe("02/03/2000");
  },
);

it("blocks month 13 as it is typed and allows correcting the month", () => {
  render(<BirthdayForm onSubmit={vi.fn()} />);
  const input = screen.getByRole("textbox", { name: "Date of Birth" });
  for (const value of ["2", "22", "22/", "22/1"]) {
    fireEvent.change(input, { target: { value } });
    expect((input as HTMLInputElement).value).toBe(value);
  }
  fireEvent.change(input, { target: { value: "22/13" } });
  expect((input as HTMLInputElement).value).toBe("22/1");
  fireEvent.change(input, { target: { value: "22/12/2026" } });
  expect((input as HTMLInputElement).value).toBe("22/12/2026");
});

it("allows deleting and retyping parts of a leap-day date", () => {
  render(<BirthdayForm birthday="2024-02-29" onSubmit={vi.fn()} />);
  const input = screen.getByRole("textbox", { name: "Date of Birth" });
  for (const value of ["29/02/202", "29/02/20", "29/02/", "29/02/2028", ""]) {
    fireEvent.change(input, { target: { value } });
    expect((input as HTMLInputElement).value).toBe(value);
  }
});

it.each(["31/02/2026", "29/02/2025", "19/13/2026"])(
  "also rejects invalid initial form values on submit: %s",
  async (birthday) => {
    const onSubmit = vi.fn();
    render(<BirthdayForm birthday={birthday} onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox", { name: "Date of Birth" });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Vui lòng nhập ngày hợp lệ (DD/MM/YYYY)."),
    ).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("birthday-error");
    expect(onSubmit).not.toHaveBeenCalled();
  },
);

it("does not submit an unfinished date", async () => {
  const onSubmit = vi.fn();
  render(<BirthdayForm onSubmit={onSubmit} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Date of Birth" }), {
    target: { value: "19/10/" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText("Vui lòng nhập ngày hợp lệ (DD/MM/YYYY)."),
  ).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

it("validates a required birthday after clearing it", async () => {
  const onSubmit = vi.fn();
  render(<BirthdayForm birthday="2000-03-02" onSubmit={onSubmit} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Date of Birth" }), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Vui lòng nhập Date of Birth.")).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

it("allows an optional birthday to stay empty", async () => {
  const onSubmit = vi.fn();
  render(<BirthdayForm required={false} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(""));
});

it("opens the calendar at a typed birthday and writes the chosen day back to the input", async () => {
  const onSubmit = vi.fn();
  render(<BirthdayForm onSubmit={onSubmit} />);
  const input = screen.getByRole("textbox", { name: "Date of Birth" });
  fireEvent.change(input, { target: { value: "19/10/2000" } });
  fireEvent.click(screen.getByRole("button", { name: "Chọn date of birth" }));
  const day = await screen.findByRole("button", {
    name: /ngày 20 tháng 10 năm 2000/,
  });
  fireEvent.click(day);
  expect((input as HTMLInputElement).value).toBe("20/10/2000");
  await waitFor(() => expect(screen.queryByRole("grid")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("20/10/2000"));
});

it("disables calendar days and rejects the same dates when typed manually", async () => {
  const onSubmit = vi.fn();
  render(
    <BirthdayForm
      birthday="2000-03-02"
      isDateDisabled={(date) => date < new Date(2000, 2, 3)}
      onSubmit={onSubmit}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Chọn date of birth" }));
  const blocked = (await screen.findByRole("button", {
    name: /ngày 2 tháng 03 năm 2000/,
  })) as HTMLButtonElement;
  expect(blocked.disabled).toBe(true);
  fireEvent.click(blocked);
  expect(
    (screen.getByRole("textbox", { name: "Date of Birth" }) as HTMLInputElement)
      .value,
  ).toBe("02/03/2000");
  fireEvent.keyDown(screen.getByRole("grid"), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Ngày này không thể chọn.");
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: "Date of Birth" }), {
    target: { value: "03/03/2000" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("03/03/2000"));
});

it("locks an already open calendar when its field becomes disabled", async () => {
  const onSubmit = vi.fn();
  const { rerender } = render(
    <BirthdayForm birthday="2000-03-02" onSubmit={onSubmit} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Chọn date of birth" }));
  const day = (await screen.findByRole("button", {
    name: /ngày 3 tháng 03 năm 2000/,
  })) as HTMLButtonElement;
  expect(day.disabled).toBe(false);
  rerender(<BirthdayForm birthday="2000-03-02" disabled onSubmit={onSubmit} />);
  const lockedDay = screen.getByRole("button", {
    name: /ngày 3 tháng 03 năm 2000/,
  }) as HTMLButtonElement;
  expect(lockedDay.disabled).toBe(true);
  fireEvent.click(lockedDay);
  expect(
    (screen.getByRole("textbox", { name: "Date of Birth" }) as HTMLInputElement)
      .value,
  ).toBe("02/03/2000");
  expect(onSubmit).not.toHaveBeenCalled();
});

it("finds a birth year quickly without changing the birthday until a day is chosen", async () => {
  const onSubmit = vi.fn();
  render(<BirthdayForm birthday="2000-10-19" onSubmit={onSubmit} />);
  const input = screen.getByRole("textbox", { name: "Date of Birth" });
  fireEvent.click(screen.getByRole("button", { name: "Chọn date of birth" }));
  fireEvent.click(screen.getByRole("button", { name: "Chọn năm" }));
  const search = await screen.findByRole("searchbox", { name: "Tìm năm" });
  fireEvent.change(search, { target: { value: "1995" } });
  expect(screen.getByRole("button", { name: "1995" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "1994" })).toBeNull();
  fireEvent.keyDown(search, { key: "Enter", code: "Enter" });
  await waitFor(() =>
    expect(screen.queryByRole("searchbox", { name: "Tìm năm" })).toBeNull(),
  );
  expect((input as HTMLInputElement).value).toBe("19/10/2000");
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.click(
    await screen.findByRole("button", { name: /ngày 20 tháng 10 năm 1995/ }),
  );
  expect((input as HTMLInputElement).value).toBe("20/10/1995");
});

it("limits the searchable years to the calendar bounds and resets search when reopened", async () => {
  render(<BirthdayForm birthday="2000-10-19" onSubmit={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Chọn date of birth" }));
  fireEvent.click(screen.getByRole("button", { name: "Chọn năm" }));
  const search = await screen.findByRole("searchbox", { name: "Tìm năm" });
  for (const year of ["1899", String(new Date().getFullYear() + 1)]) {
    fireEvent.change(search, { target: { value: year } });
    expect(screen.getByText("Không tìm thấy năm phù hợp.")).toBeTruthy();
  }
  fireEvent.change(search, { target: { value: "1900" } });
  fireEvent.click(screen.getByRole("button", { name: "1900" }));
  expect(
    await screen.findByRole("button", { name: /ngày 20 tháng 10 năm 1900/ }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Chọn năm" }));
  const reopenedSearch = await screen.findByRole("searchbox", {
    name: "Tìm năm",
  });
  expect((reopenedSearch as HTMLInputElement).value).toBe("");
  expect(
    screen.getByRole("button", { name: "1900" }).getAttribute("aria-pressed"),
  ).toBe("true");
});

it("Escape dismisses only the year picker and keeps the calendar open", async () => {
  render(<BirthdayForm birthday="2000-10-19" onSubmit={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Chọn date of birth" }));
  fireEvent.click(screen.getByRole("button", { name: "Chọn năm" }));
  const search = await screen.findByRole("searchbox", { name: "Tìm năm" });
  fireEvent.keyDown(search, { key: "Escape", code: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("searchbox", { name: "Tìm năm" })).toBeNull(),
  );
  expect(screen.getByRole("grid", { name: "Tháng Mười 2000" })).toBeTruthy();
});
