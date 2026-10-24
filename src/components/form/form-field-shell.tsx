import { translateMessage, useLocale } from "@/i18n";
import type { ReactNode } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { TruncatedText } from "@/components/truncated-text";

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
  useLocale();
  return (
    <Field className={cn("min-w-0", className)} data-invalid={invalid}>
      <FieldLabel
        htmlFor={id}
        className="min-w-0 max-w-full text-sm font-semibold text-foreground"
      >
        <TruncatedText text={label} />
        {required && (
          <span className="shrink-0 text-destructive" aria-hidden="true">
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
          title={error?.message ? translateMessage(error.message) : undefined}
          className="min-w-0 truncate text-sm text-destructive"
        />
      )}
    </Field>
  );
}
