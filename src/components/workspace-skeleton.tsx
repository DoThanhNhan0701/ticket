import { t, useLocale } from "@/i18n";
import { BrandLogo } from "@/components/brand-logo";

export function WorkspaceSkeleton() {
  useLocale();
  return (
    <div
      role="status"
      aria-label={t("common", "Loading...")}
      data-workspace-loading=""
      className="flex min-h-0 w-full flex-1 flex-col gap-3"
    >
      <div
        aria-hidden="true"
        className="flex h-11 shrink-0 items-center gap-2 sm:h-10"
      >
        <div className="size-8 rounded-lg bg-(--workspace-skeleton-fill)" />
        <div className="space-y-2">
          <div className="h-4 w-40 rounded bg-(--workspace-skeleton-fill)" />
          <div className="h-3 w-56 max-w-[50vw] rounded bg-(--workspace-skeleton-fill)" />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="flex min-h-14 shrink-0 items-center gap-3 rounded-xl border border-(--workspace-skeleton-border) bg-card p-3"
      >
        <div className="h-9 min-w-0 flex-1 rounded-lg bg-(--workspace-skeleton-fill) sm:max-w-80" />
        <div className="h-9 w-24 shrink-0 rounded-lg bg-(--workspace-skeleton-fill)" />
      </div>
      <div
        aria-hidden="true"
        className="min-h-64 flex-1 overflow-hidden rounded-xl border border-(--workspace-skeleton-border) bg-card sm:min-h-72"
      >
        <div className="h-10 border-b border-(--workspace-skeleton-border) bg-(--workspace-skeleton-soft)" />
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="flex h-14 items-center gap-4 border-b border-(--workspace-skeleton-border)/50 px-4"
          >
            <div className="h-3 w-14 rounded bg-(--workspace-skeleton-fill)" />
            <div className="h-3 flex-1 rounded bg-(--workspace-skeleton-soft)" />
            <div className="hidden h-3 w-24 rounded bg-(--workspace-skeleton-soft) sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkspaceHeaderSkeleton() {
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <div
          aria-hidden="true"
          className="size-11 shrink-0 rounded-lg bg-(--workspace-skeleton-soft) lg:hidden"
        />
        <BrandLogo variant="mark" className="size-8 sm:hidden" />
        <BrandLogo className="hidden h-7 w-[clamp(5.5rem,calc(100vw-16rem),10rem)] sm:inline-block" />
      </div>
      <div
        aria-hidden="true"
        className="h-11 w-36 shrink-0 rounded-lg bg-(--workspace-skeleton-soft)"
      />
    </>
  );
}

export function WorkspaceSidebarSkeleton({
  collapsed = false,
}: Readonly<{ collapsed?: boolean }>) {
  return (
    <div aria-hidden="true" className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-3 pt-3 pb-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-3 rounded-lg px-2"
          >
            <div className="size-5 shrink-0 rounded bg-(--workspace-skeleton-fill)" />
            {!collapsed && (
              <div className="h-3 flex-1 rounded bg-(--workspace-skeleton-soft)" />
            )}
          </div>
        ))}
      </div>
      <div className="flex h-[69px] shrink-0 items-center justify-center border-t border-sidebar-border">
        <div className="size-4 rounded bg-(--workspace-skeleton-fill)" />
      </div>
    </div>
  );
}
