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
    <Card
      data-request-step={step}
      className="min-w-0 gap-1.5 rounded-lg px-2.5 py-2 sm:px-3"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {step !== undefined && (
            <span
              aria-hidden="true"
              className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-foreground"
            >
              {step}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
            <h2 className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] leading-4 font-semibold">
              {title}
            </h2>
            {description && (
              <p className="text-[0.6875rem] leading-3.5 text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
        )}
      </div>
      {children}
    </Card>
  );
}
