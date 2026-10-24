// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useForm } from "react-hook-form";
import { PasswordField } from "@/components/form/password-field";
import { MultiSelectField } from "@/components/form/multi-select-field";

afterEach(cleanup);
let resize: ResizeObserverCallback;
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function (callback: ResizeObserverCallback) {
      resize = callback;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }),
  );
});

function PasswordForm() {
  const { control } = useForm({ defaultValues: { password: "secret123" } });
  return (
    <PasswordField
      control={control}
      name="password"
      id="password"
      label="Mật khẩu"
    />
  );
}
const categoriesOptions = [
  { value: "HR", label: "Human Resources" },
  ...["AF", "AI", "Frontend", "Backend", "Quality Assurance"].map((label) => ({
    value: label,
    label,
  })),
];
function CategoriesForm({
  categories = ["HR"],
  maxBadgeCount,
}: Readonly<{ categories?: string[]; maxBadgeCount?: number }>) {
  const { control } = useForm({ defaultValues: { categories } });
  return (
    <MultiSelectField
      control={control}
      name="categories"
      id="categories"
      label="Categories"
      options={categoriesOptions}
      maxBadgeCount={maxBadgeCount}
    />
  );
}
describe("shared form controls", () => {
  it("toggles password visibility with an accessible button", () => {
    render(<PasswordForm />);
    const input = screen.getByLabelText("Mật khẩu");
    expect(input.getAttribute("type")).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    expect(input.getAttribute("type")).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Ẩn mật khẩu" }));
    expect(input.getAttribute("type")).toBe("password");
  });
  it("removes a selected category without nested interactive controls", () => {
    const { container } = render(<CategoriesForm />);
    expect(container.querySelector("button button")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Human Resources" }),
    );
    expect(
      screen.queryByRole("button", { name: "Remove Human Resources" }),
    ).toBeNull();
    expect(screen.getByText("Chọn danh mục...")).toBeTruthy();
  });
  it("keeps every selection while collapsing badges as the field narrows", () => {
    render(
      <CategoriesForm
        categories={categoriesOptions.map((option) => option.value)}
        maxBadgeCount={3}
      />,
    );
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(3);
    expect(screen.getByText("+3")).toBeTruthy();
    act(() =>
      resize(
        [{ contentRect: { width: 128 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    );
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(1);
    expect(screen.getByText("+5")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Human Resources" }),
    );
    expect(screen.getByText("+4")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove AF" })).toBeTruthy();
    act(() =>
      resize(
        [{ contentRect: { width: 400 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    );
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(3);
    expect(screen.getByText("+2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    expect(screen.getByText("Đã chọn 5/6")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Human Resources" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Quality Assurance" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("shows a selection count when only the counter fits and still allows clearing", () => {
    render(
      <CategoriesForm
        categories={categoriesOptions.map((option) => option.value)}
      />,
    );
    act(() =>
      resize(
        [{ contentRect: { width: 32 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    );
    expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
    expect(screen.getByText("+6")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear categories" }));
    expect(screen.queryByText("+6")).toBeNull();
    expect(screen.getByText("Chọn danh mục...")).toBeTruthy();
  });
});
