import type { ReactNode } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

interface FormFieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  invalid?: boolean;
  error?: { message?: string };
  labelAddon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function FormFieldShell({
  id,
  label,
  required,
  invalid,
  error,
  labelAddon,
  className,
  children,
}: Readonly<FormFieldShellProps>) {
  return (
    <Field className={cn("min-w-0", className)} data-invalid={invalid}>
      <FieldLabel
        htmlFor={id}
        className="text-sm font-semibold text-foreground"
      >
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        )}
        {labelAddon}
      </FieldLabel>
      {children}
      {invalid && (
        <FieldError
          id={`${id}-error`}
          errors={[error]}
          className="text-sm text-destructive"
        />
      )}
    </Field>
  );
}
