import type { ComponentProps, ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FormFieldShell } from "./form-field-shell";

export interface InputFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  id: string;
  label: string;
  type?: "email" | "number" | "text" | "password" | "tel" | "url";
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: ComponentProps<typeof Input>["autoComplete"];
  className?: string;
  icon?: ReactNode;
  labelAddon?: ReactNode;
  inputClassName?: string;
}

export function InputField<TFieldValues extends FieldValues>({
  control,
  name,
  id,
  label,
  type = "text",
  placeholder,
  required = false,
  disabled,
  autoComplete = "off",
  className,
  icon,
  labelAddon,
  inputClassName,
}: Readonly<InputFieldProps<TFieldValues>>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={required ? { required: `${label} is required.` } : undefined}
      render={({ field, fieldState }) => (
        <FormFieldShell
          id={id}
          label={label}
          required={required}
          invalid={fieldState.invalid}
          error={fieldState.error}
          labelAddon={labelAddon}
          className={className}
        >
          <div className="relative flex items-center">
            <Input
              {...field}
              id={id}
              type={type}
              disabled={disabled}
              placeholder={placeholder}
              autoCapitalize="off"
              autoComplete={autoComplete}
              spellCheck={false}
              aria-invalid={fieldState.invalid}
              aria-required={required}
              aria-describedby={fieldState.error ? `${id}-error` : undefined}
              className={cn(icon && "pr-12", inputClassName)}
            />
            {icon && (
              <span className="absolute right-1 flex items-center text-muted-foreground">
                {icon}
              </span>
            )}
          </div>
        </FormFieldShell>
      )}
    />
  );
}
