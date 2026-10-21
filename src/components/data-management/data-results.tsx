import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { DataPagination } from "./data-pagination";
import type { DataListQuery, DataPaginationProps } from "./types";

export function DataResults<T>({
  query,
  label,
  loadingMessage = "Đang tải danh sách...",
  errorPrefix = "Không tải được danh sách",
  emptyTitle = "Không tìm thấy dữ liệu",
  emptyDescription = "Thử thay đổi từ khóa hoặc bộ lọc để tìm dữ liệu phù hợp.",
  pagination,
  renderRows,
  refreshStyle = "overlay",
}: Readonly<{
  query: DataListQuery<T>;
  label: string;
  loadingMessage?: string;
  errorPrefix?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  pagination: Omit<DataPaginationProps, "count" | "disabled">;
  renderRows: (rows: T[]) => ReactNode;
  refreshStyle?: "overlay" | "subtle";
}>) {
  const retainData = refreshStyle === "subtle" && Boolean(query.data);
  const data = visibleData(query, refreshStyle);
  return (
    <section
      aria-label={label}
      aria-busy={query.isFetching}
      className="relative flex min-h-64 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:min-h-72"
    >
      {query.isPending && <LoadingState message={loadingMessage} />}
      {query.isError && (
        <div
          className={
            retainData
              ? "absolute inset-x-2 top-2 z-20 space-y-2 rounded-lg border bg-card p-3 shadow-sm"
              : "space-y-3 p-4"
          }
        >
          <ErrorAlert
            message={`${errorPrefix}: ${query.error?.message ?? "Lỗi không xác định"}`}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                query.refetch();
              }}
            >
              Thử lại
            </Button>
            {pagination.page > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => pagination.onPage(1)}
              >
                Về trang đầu
              </Button>
            )}
          </div>
        </div>
      )}
      {data && (
        <>
          {data.results.length > 0 ? (
            renderRows(data.results)
          ) : (
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              icon={<Inbox className="size-6" aria-hidden="true" />}
              className="flex-1 rounded-none border-0 shadow-none"
            />
          )}
          {data.results.length > 0 && (
            <DataPagination
              {...pagination}
              count={data.count}
              disabled={
                query.isPlaceholderData || query.isFetching || query.isError
              }
            />
          )}
        </>
      )}
      {query.isFetching && !query.isPending && (
        <DataRefreshIndicator style={refreshStyle} />
      )}
    </section>
  );
}

function visibleData<T>(
  query: DataListQuery<T>,
  refreshStyle: "subtle" | "overlay",
) {
  if (query.isPending || (query.isError && refreshStyle !== "subtle")) return;
  return query.data;
}

function DataRefreshIndicator({
  style,
}: Readonly<{ style: "subtle" | "overlay" }>) {
  if (style === "subtle")
    return (
      <div
        role="status"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-primary/15"
      >
        <span className="block h-full w-full animate-pulse bg-primary/60 motion-reduce:animate-none" />
        <span className="sr-only">Đang cập nhật danh sách...</span>
      </div>
    );
  return (
    <LoadingState
      message="Đang cập nhật danh sách..."
      className="absolute inset-0 z-20 bg-card/80"
    />
  );
}
