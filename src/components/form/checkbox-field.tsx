import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { FormFieldShell } from "./form-field-shell";

export function CheckboxField<T extends FieldValues>({
  control,
  name,
  id,
  label,
  disabled,
}: Readonly<{
  control: Control<T>;
  name: FieldPath<T>;
  id: string;
  label: string;
  disabled?: boolean;
}>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormFieldShell
          id={id}
          label={label}
          invalid={fieldState.invalid}
          error={fieldState.error}
        >
          <div>
            <Checkbox
              id={id}
              name={field.name}
              ref={field.ref}
              checked={field.value === true}
              onCheckedChange={field.onChange}
              onBlur={field.onBlur}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.error ? `${id}-error` : undefined}
            />
          </div>
        </FormFieldShell>
      )}
    />
  );
}
