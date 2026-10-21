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
import { TimePicker } from "@/components/ui/time-picker";
import { TimePickerField } from "@/components/form/time-picker-field";
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
function Example({
  initial = "",
  disabled = false,
}: {
  initial?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="time">Giờ bắt đầu</label>
      <TimePicker
        id="time"
        label="Giờ bắt đầu"
        value={value}
        onValueChange={setValue}
        disabled={disabled}
      />
    </>
  );
}
it("selects 24-hour time including boundary minutes and can clear it", async () => {
  render(<Example />);
  fireEvent.click(screen.getByRole("button", { name: "Chọn giờ bắt đầu" }));
  fireEvent.click(await screen.findByRole("button", { name: "Giờ 23" }));
  fireEvent.click(screen.getByRole("button", { name: "Phút 59" }));
  expect((screen.getByLabelText("Giờ bắt đầu") as HTMLInputElement).value).toBe(
    "23:59",
  );
  fireEvent.click(screen.getByRole("button", { name: "Xong" }));
  await waitFor(() =>
    expect(screen.queryByRole("group", { name: "Giờ" })).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Chọn giờ bắt đầu" }));
  fireEvent.click(await screen.findByRole("button", { name: "Xóa giờ" }));
  expect((screen.getByLabelText("Giờ bắt đầu") as HTMLInputElement).value).toBe(
    "",
  );
});
it("opens from the keyboard and navigates hours and minutes without submitting", async () => {
  render(<Example initial="00:00" />);
  fireEvent.keyDown(screen.getByLabelText("Giờ bắt đầu"), { key: "ArrowDown" });
  const hour = await screen.findByRole("button", { name: "Giờ 00" });
  fireEvent.keyDown(hour, { key: "ArrowUp" });
  expect((screen.getByLabelText("Giờ bắt đầu") as HTMLInputElement).value).toBe(
    "23:00",
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Phút 00" }), {
    key: "End",
  });
  expect((screen.getByLabelText("Giờ bắt đầu") as HTMLInputElement).value).toBe(
    "23:59",
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Giờ 23" }), {
    key: "Home",
  });
  expect((screen.getByLabelText("Giờ bắt đầu") as HTMLInputElement).value).toBe(
    "00:59",
  );
});
it("normalizes valid manual input on blur and preserves invalid input for validation", () => {
  render(<Example />);
  const input = screen.getByLabelText("Giờ bắt đầu") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "9:05" } });
  fireEvent.blur(input);
  expect(input.value).toBe("09:05");
  fireEvent.change(input, { target: { value: "24:60" } });
  fireEvent.blur(input);
  expect(input.value).toBe("24:60");
});
it("disables input and popover trigger together", () => {
  render(<Example disabled initial="09:00" />);
  expect(screen.getByLabelText("Giờ bắt đầu").hasAttribute("disabled")).toBe(
    true,
  );
  const trigger = screen.getByRole("button", { name: "Chọn giờ bắt đầu" });
  expect(trigger.hasAttribute("disabled")).toBe(true);
  fireEvent.click(trigger);
  expect(screen.queryByRole("group", { name: "Giờ" })).toBeNull();
});
it("Escape closes the time popover without dismissing its parent modal", async () => {
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Lịch phỏng vấn</DialogTitle>
        <Example />
      </DialogContent>
    </Dialog>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Chọn giờ bắt đầu" }));
  const popup = await screen.findByRole("dialog", { name: "Chọn giờ bắt đầu" });
  fireEvent.keyDown(popup, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("group", { name: "Giờ" })).toBeNull(),
  );
  expect(screen.getByRole("dialog", { name: "Lịch phỏng vấn" })).toBeTruthy();
});
it("validates the form field and clears errors after correcting a time", async () => {
  const save = vi.fn();
  function Form() {
    const form = useForm({ defaultValues: { time: "" }, mode: "onChange" });
    return (
      <form onSubmit={form.handleSubmit(save)}>
        <TimePickerField
          control={form.control}
          name="time"
          id="field-time"
          label="Giờ bắt đầu"
          required
        />
        <button type="submit">Lưu</button>
      </form>
    );
  }
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await screen.findByText("Vui lòng chọn giờ bắt đầu.");
  fireEvent.change(screen.getByLabelText(/^Giờ bắt đầu/), {
    target: { value: "24:00" },
  });
  await screen.findByText("Giờ không hợp lệ. Vui lòng nhập HH:mm.");
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/^Giờ bắt đầu/), {
    target: { value: "00:00" },
  });
  await waitFor(() =>
    expect(
      screen.queryByText("Giờ không hợp lệ. Vui lòng nhập HH:mm."),
    ).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({ time: "00:00" }, expect.anything()),
  );
});
