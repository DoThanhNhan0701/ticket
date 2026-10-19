import type { ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TruncatedText } from "@/components/truncated-text";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  onBack?: () => void;
  backDisabled?: boolean;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  onBack,
  backDisabled,
  actions,
}: Readonly<PageHeaderProps>) {
  return (
    <header className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9"
            aria-label="Back to home"
            onClick={onBack}
            disabled={backDisabled}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        {Icon && (
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-700 sm:flex dark:border-brand-700 dark:bg-brand-950 dark:text-brand-200">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <div className="flex min-h-8 min-w-0 flex-col justify-center sm:min-h-10">
          <h1 className="text-base font-semibold tracking-tight text-foreground sm:text-xl">
            <TruncatedText text={title} className="sm:whitespace-normal" />
          </h1>
          {description && (
            <p className="mt-1 hidden text-sm leading-relaxed text-muted-foreground sm:block">
              <TruncatedText
                text={description}
                className="sm:whitespace-normal"
              />
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
