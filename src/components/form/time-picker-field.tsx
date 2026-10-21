import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { TimePicker } from "@/components/ui/time-picker";
import { FormFieldShell } from "./form-field-shell";

export function TimePickerField<T extends FieldValues>({
  control,
  name,
  id,
  label,
  required,
  disabled,
  className,
}: Readonly<{
  control: Control<T>;
  name: FieldPath<T>;
  id: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: required ? `Vui lòng chọn ${label.toLowerCase()}.` : false,
        validate: (value) =>
          !value ||
          /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value)) ||
          "Giờ không hợp lệ. Vui lòng nhập HH:mm.",
      }}
      render={({ field, fieldState }) => (
        <FormFieldShell
          id={id}
          label={label}
          required={required}
          invalid={fieldState.invalid}
          error={fieldState.error}
          className={className}
        >
          <TimePicker
            {...field}
            id={id}
            label={label}
            value={String(field.value ?? "")}
            onValueChange={field.onChange}
            disabled={disabled}
            aria-required={required}
            aria-invalid={fieldState.invalid}
            aria-describedby={fieldState.error ? `${id}-error` : undefined}
          />
        </FormFieldShell>
      )}
    />
  );
}
