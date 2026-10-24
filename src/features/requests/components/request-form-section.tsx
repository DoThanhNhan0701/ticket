import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function RequestFormSection({
  step,
  title,
  description,
  actions,
  children,
}: Readonly<{
  step?: number;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <Card data-request-step={step} className="min-w-0 gap-4 p-4 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {step !== undefined && (
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-semibold text-foreground"
            >
              {step}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="flex min-w-0 items-center gap-2 font-semibold">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </Card>
  );
}
