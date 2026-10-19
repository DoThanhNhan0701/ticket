import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "border-border bg-muted text-foreground",
  brand:
    "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-200",
  success: "border-success-border bg-success-soft text-success",
  warning: "border-warning-border bg-warning-soft text-warning",
  danger: "border-danger-border bg-danger-soft text-destructive",
};

type BadgeProps = ComponentProps<"span"> & { tone?: keyof typeof tones };

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium leading-none",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
