import { cn } from "@/lib/utils";

export const dataResultsClassName =
  "relative flex min-h-64 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:min-h-72";

const resultColumns =
  "grid-cols-[4rem_12rem_12rem_16rem_repeat(7,minmax(0,1fr))]";
const columnCount = 11;

export function DataResultsSkeleton({
  message,
}: Readonly<{ message?: string }>) {
  return (
    <>
      {message && (
        <span role="status" className="sr-only">
          {message}
        </span>
      )}
      <div
        aria-hidden="true"
        data-slot="data-results-skeleton"
        className="min-h-0 flex-1 overflow-hidden"
      >
        <div className="min-w-352">
          <div
            className={cn(
              "grid h-12 items-center border-b bg-subtle",
              resultColumns,
            )}
          >
            {Array.from({ length: columnCount }, (_, column) => (
              <div
                key={column}
                className="mx-3 h-2.5 rounded bg-(--workspace-skeleton-fill)"
              />
            ))}
          </div>
          {Array.from({ length: 10 }, (_, row) => (
            <div
              key={row}
              className={cn(
                "grid h-18 items-center border-b border-border",
                resultColumns,
              )}
            >
              {Array.from({ length: columnCount }, (_, column) => (
                <div
                  key={column}
                  className={cn(
                    "h-3 rounded bg-(--workspace-skeleton-soft)",
                    column === 0 ? "mx-auto w-5" : "ml-3 w-2/3",
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div
        aria-hidden="true"
        className="flex shrink-0 items-center justify-between gap-2 border-t border-border p-2 sm:gap-4 sm:p-4"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <div className="h-3 w-12 rounded bg-(--workspace-skeleton-fill) sm:w-44" />
          <div className="h-11 w-16 rounded-lg bg-(--workspace-skeleton-soft) min-[400px]:w-24 sm:h-10 sm:pointer-coarse:h-11" />
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <div className="size-11 rounded-lg bg-(--workspace-skeleton-soft) sm:size-9 sm:pointer-coarse:size-11" />
          <div className="h-11 w-16 rounded-lg bg-(--workspace-skeleton-soft) sm:h-9 sm:w-24 sm:pointer-coarse:h-11" />
          <div className="size-11 rounded-lg bg-(--workspace-skeleton-soft) sm:size-9 sm:pointer-coarse:size-11" />
        </div>
      </div>
    </>
  );
}

export function DataSearchSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-slot="data-search-skeleton"
      className="hidden h-10 max-w-3xl shrink-0 items-center gap-2 sm:flex sm:pointer-coarse:h-11"
    >
      <div className="h-full min-w-0 flex-1 rounded-lg bg-(--workspace-skeleton-fill)" />
      <div className="h-full w-48 shrink-0 rounded-lg bg-(--workspace-skeleton-soft)" />
      <div className="h-full w-24 shrink-0 rounded-lg bg-(--workspace-skeleton-fill)" />
      <div className="h-full w-28 shrink-0 rounded-lg bg-(--workspace-skeleton-soft)" />
    </div>
  );
}
