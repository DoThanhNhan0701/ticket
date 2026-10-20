import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
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
            <input
              type="checkbox"
              id={id}
              name={field.name}
              ref={field.ref}
              checked={field.value === true}
              onChange={(event) => field.onChange(event.target.checked)}
              onBlur={field.onBlur}
              disabled={disabled}
              className="size-5 cursor-pointer rounded border-border accent-primary disabled:cursor-not-allowed"
            />
          </div>
        </FormFieldShell>
      )}
    />
  );
}
