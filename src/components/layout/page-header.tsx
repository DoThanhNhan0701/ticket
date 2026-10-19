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
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            aria-label="Back to home"
            onClick={onBack}
            disabled={backDisabled}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        {Icon && (
          <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-700 sm:flex dark:border-brand-700 dark:bg-brand-950 dark:text-brand-200">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
        <div className="flex min-h-7 min-w-0 flex-col justify-center sm:min-h-8">
          <h1 className="text-sm leading-5 font-semibold tracking-tight text-foreground sm:text-base">
            <TruncatedText text={title} />
          </h1>
          {description && (
            <p className="mt-0.5 hidden text-xs leading-4 text-muted-foreground sm:block">
              <TruncatedText text={description} />
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex h-full min-w-0 shrink-0 items-center gap-2 [&>a]:h-full [&>button]:h-full">
          {actions}
        </div>
      )}
    </header>
  );
}
