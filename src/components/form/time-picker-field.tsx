import { t, useLocale } from "@/i18n";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { TimePicker } from "@/components/ui/time-picker";
import { FormFieldShell } from "./form-field-shell";
import { validateTimeRange } from "@/lib/time-range";

export function TimePickerField<T extends FieldValues>({
  control,
  name,
  id,
  label,
  required,
  disabled,
  className,
  minTime,
  maxTime,
}: Readonly<{
  control: Control<T>;
  name: FieldPath<T>;
  id: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  minTime?: string;
  maxTime?: string;
}>) {
  useLocale();
  const hintId = minTime && maxTime ? `${id}-hint` : undefined;
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: required
          ? t("common", "Vui lòng chọn {0}.", [label.toLowerCase()])
          : false,
        validate: (value) =>
          validateTimeRange(String(value ?? ""), minTime, maxTime) ?? true,
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
            minTime={minTime}
            maxTime={maxTime}
            aria-required={required}
            aria-invalid={fieldState.invalid}
            aria-describedby={fieldState.error ? `${id}-error` : hintId}
          />
          {minTime && maxTime && (
            <p id={hintId} className="text-xs text-muted-foreground">
              {" "}
              {t("common", "Khung giờ cho phép:")} {minTime} – {maxTime}.
            </p>
          )}
        </FormFieldShell>
      )}
    />
  );
}
