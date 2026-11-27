import { t, useLocale } from "@/i18n";
import { MobilePageActionSlot } from "./mobile-page-action";
import type { ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TruncatedText } from "@/components/truncated-text";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  onBack?: () => void;
  backLabel?: string;
  backDisabled?: boolean;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  onBack,
  backLabel = t("common", "Back to home"),
  backDisabled,
  actions,
}: Readonly<PageHeaderProps>) {
  useLocale();
  return (
    <header className="flex h-8 shrink-0 items-center justify-between gap-2 sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            aria-label={backLabel}
            title={backLabel}
            onClick={onBack}
            disabled={backDisabled}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        {Icon && (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-200">
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
        )}
        <div className="flex min-h-7 min-w-0 flex-1 flex-col justify-center">
          <h1 className="text-[0.8125rem] leading-4 font-semibold tracking-tight text-foreground">
            <TruncatedText text={title} />
          </h1>
          {description && (
            <p className="text-[0.6875rem] leading-3.5 text-muted-foreground">
              <TruncatedText text={description} />
            </p>
          )}
        </div>
      </div>
      <MobilePageActionSlot />
      {actions && (
        <div className="flex min-w-0 shrink-0 items-center gap-2 max-sm:[&>a]:size-8 max-sm:[&>a]:p-0 max-sm:[&>button]:size-8 max-sm:[&>button]:p-0 max-sm:[&_svg]:size-4 sm:h-full sm:[&>a]:h-full sm:[&>button]:h-full">
          {actions}
        </div>
      )}
    </header>
  );
}
