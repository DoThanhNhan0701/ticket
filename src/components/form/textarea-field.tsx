import { t, useLocale } from "@/i18n";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { FormFieldShell } from "./form-field-shell";

interface TextareaFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  className?: string;
}

export function TextareaField<TFieldValues extends FieldValues>({
  control,
  name,
  id,
  label,
  placeholder,
  required = false,
  disabled,
  rows = 3,
  className,
}: Readonly<TextareaFieldProps<TFieldValues>>) {
  useLocale();
  return (
    <Controller
      control={control}
      name={name}
      rules={
        required
          ? { required: t("common", "{0} is required.", [label]) }
          : undefined
      }
      render={({ field, fieldState }) => (
        <FormFieldShell
          id={id}
          label={label}
          required={required}
          invalid={fieldState.invalid}
          error={fieldState.error}
          className={className}
        >
          <Textarea
            {...field}
            id={id}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            aria-invalid={fieldState.invalid}
            aria-required={required}
            aria-describedby={fieldState.error ? `${id}-error` : undefined}
          />
        </FormFieldShell>
      )}
    />
  );
}
