import type { ReactNode } from "react";

export function PageHeaderSkeleton({
  actions,
}: Readonly<{ actions?: ReactNode }>) {
  return (
    <div
      aria-hidden="true"
      data-slot="page-header-skeleton"
      className="flex h-11 shrink-0 items-center justify-between gap-2 sm:h-8 sm:gap-3"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="size-8 shrink-0 rounded-lg bg-(--workspace-skeleton-fill)" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-4 w-40 max-w-full rounded bg-(--workspace-skeleton-fill)" />
          <div className="h-3 w-56 max-w-full rounded bg-(--workspace-skeleton-soft)" />
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
