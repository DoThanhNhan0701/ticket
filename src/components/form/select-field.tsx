import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { FormFieldShell } from "./form-field-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  id: string;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  noDataText?: string;
  required?: boolean;
  className?: string;
  labelAddon?: ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
}

export function SelectField<TFieldValues extends FieldValues>({
  control,
  name,
  id,
  label,
  options,
  placeholder = "Select...",
  noDataText = "No data",
  required = false,
  className,
  labelAddon,
  disabled = false,
  isLoading = false,
}: SelectFieldProps<TFieldValues>) {
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
          className={className}
          labelAddon={labelAddon}
        >
          <Select
            value={field.value || undefined}
            onValueChange={field.onChange}
            disabled={disabled || isLoading}
          >
            <SelectTrigger
              id={id}
              onBlur={field.onBlur}
              ref={field.ref}
              aria-describedby={fieldState.error ? `${id}-error` : undefined}
              className="w-full"
              aria-invalid={fieldState.invalid}
            >
              <SelectValue
                placeholder={isLoading ? "Loading list..." : placeholder}
              />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {!isLoading && options.length === 0 ? (
                <div className="py-3 px-2 text-center text-xs text-muted-foreground italic">
                  {noDataText}
                </div>
              ) : (
                options.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-xs py-1.5 px-2 cursor-pointer focus:bg-muted focus:text-foreground"
                  >
                    {opt.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </FormFieldShell>
      )}
    />
  );
}
