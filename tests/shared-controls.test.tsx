// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useForm } from "react-hook-form";
import { PasswordField } from "@/components/form/password-field";
import { MultiSelectField } from "@/components/form/multi-select-field";

afterEach(cleanup);

function PasswordForm() {
  const { control } = useForm({ defaultValues: { password: "secret123" } });
  return (
    <PasswordField
      control={control}
      name="password"
      id="password"
      label="Password"
    />
  );
}
function CategoriesForm() {
  const { control } = useForm({ defaultValues: { categories: ["HR"] } });
  return (
    <MultiSelectField
      control={control}
      name="categories"
      id="categories"
      label="Categories"
      options={[{ value: "HR", label: "Human Resources" }]}
    />
  );
}
describe("shared form controls", () => {
  it("toggles password visibility with an accessible button", () => {
    render(<PasswordForm />);
    const input = screen.getByLabelText("Password");
    expect(input.getAttribute("type")).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.getAttribute("type")).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
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
    expect(screen.getByText("Select categories...")).toBeTruthy();
  });
});
