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
}: Readonly<{
  query: DataListQuery<T>;
  label: string;
  loadingMessage?: string;
  errorPrefix?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  pagination: Omit<DataPaginationProps, "count" | "disabled">;
  renderRows: (rows: T[]) => ReactNode;
}>) {
  return (
    <section
      aria-label={label}
      aria-busy={query.isFetching}
      className="relative flex min-h-112 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:min-h-72"
    >
      {query.isPending && <LoadingState message={loadingMessage} />}
      {query.isError && (
        <div className="space-y-3 p-4">
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
      {!query.isPending && !query.isError && query.data && (
        <>
          {query.data.results.length > 0 ? (
            renderRows(query.data.results)
          ) : (
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              icon={<Inbox className="size-6" aria-hidden="true" />}
              className="rounded-none border-0 shadow-none"
            />
          )}
          {query.data.results.length > 0 && (
            <DataPagination
              {...pagination}
              count={query.data.count}
              disabled={query.isPlaceholderData || query.isFetching}
            />
          )}
        </>
      )}
      {query.isFetching && !query.isPending && (
        <LoadingState
          message="Đang cập nhật danh sách..."
          className="absolute inset-0 z-20 bg-card/80"
        />
      )}
    </section>
  );
}
