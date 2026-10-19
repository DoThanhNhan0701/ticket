import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  illustration?: string;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  illustration,
  className,
}: Readonly<EmptyStateProps>) {
  return (
    <Card
      className={cn(
        "flex min-h-56 items-center justify-center p-8 text-center shadow-sm",
        className,
      )}
    >
      <div className="flex max-w-md flex-col items-center gap-3">
        {illustration && (
          <img
            src={illustration}
            alt=""
            width={500}
            height={250}
            className="h-28 w-56 max-w-full object-contain"
          />
        )}
        {icon && (
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            {icon}
          </span>
        )}
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </Card>
  );
}
