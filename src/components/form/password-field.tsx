import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { FieldValues } from "react-hook-form";
import { InputField, type InputFieldProps } from "./input-field";

type PasswordFieldProps<TFieldValues extends FieldValues> = Omit<
  InputFieldProps<TFieldValues>,
  "type" | "icon"
> & {
  disabled?: boolean;
};

export function PasswordField<TFieldValues extends FieldValues>({
  disabled,
  ...props
}: Readonly<PasswordFieldProps<TFieldValues>>) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = isVisible ? EyeOff : Eye;
  return (
    <InputField
      {...props}
      disabled={disabled}
      type={isVisible ? "text" : "password"}
      icon={
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsVisible((visible) => !visible)}
          aria-label={`${isVisible ? "Hide" : "Show"} ${props.label.toLowerCase()}`}
          aria-pressed={isVisible}
          className="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded sm:pointer-coarse:h-11 sm:pointer-coarse:w-11 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      }
    />
  );
}
