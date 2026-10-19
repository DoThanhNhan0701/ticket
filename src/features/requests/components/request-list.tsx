import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import {
  listRequestsRequest,
  listRequestStatusesRequest,
} from "../api/requests-api";
import { requestFilterFields, type RequestFilters } from "../types";
import { parseRequestListParams } from "../utils/request-list-params";
import { RequestSearch } from "./request-filters";
import { RequestFiltersDrawer } from "./request-filters-drawer";
import { RequestPagination } from "./request-pagination";
import { RequestTable } from "./request-table";

export function RequestList() {
  const { userId } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = parseRequestListParams(searchParams);
  const advancedFilters: RequestFilters = {};
  for (const { name } of requestFilterFields)
    advancedFilters[name] = params[name] ?? "";
  const hasAdvancedFilters = requestFilterFields.some(({ name }) =>
    Boolean(params[name]),
  );
  const hasFilters = Boolean(
    params.searchAll || params.ticket_status_name || hasAdvancedFilters,
  );

  const requests = useQuery({
    queryKey: ["requests", userId, params],
    queryFn: ({ signal }) => listRequestsRequest(params, signal),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const statuses = useQuery({
    queryKey: ["request-statuses", userId],
    queryFn: ({ signal }) => listRequestStatusesRequest(signal),
    retry: false,
  });

  const update = (
    values: Record<string, string | number | undefined>,
    remove: readonly string[] = [],
  ) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("columnSort");
      next.delete("typeSort");
      for (const key of remove) next.delete(key);
      next.set("page", "1");
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined || String(value).trim() === "")
          next.delete(key);
        else next.set(key, String(value).trim());
      }
      return next;
    });
  };
  const clearAdvanced = () =>
    update(
      {},
      requestFilterFields.map(({ name }) => name),
    );
  const knownStatus = statuses.data?.some(
    (status) => status.name === params.ticket_status_name,
  );
  const statusOptions = [
    { value: "all", label: "Tất cả trạng thái" },
    ...(statuses.data ?? []).map((status) => ({
      value: status.name,
      label: status.name,
    })),
  ];
  if (params.ticket_status_name && !knownStatus)
    statusOptions.push({
      value: params.ticket_status_name,
      label: params.ticket_status_name,
    });

  return (
    <div className="flex min-h-112 min-w-0 flex-1 flex-col gap-4">
      <div className="shrink-0 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 overflow-x-auto p-4">
          <RequestSearch
            key={JSON.stringify(params)}
            initialValue={params.searchAll ?? ""}
            initialStatus={params.ticket_status_name ?? "all"}
            statusOptions={statusOptions}
            statusLoading={statuses.isPending}
            onSearch={(value, status) =>
              update(
                {
                  searchAll: value,
                  ticket_status_name: status === "all" ? undefined : status,
                },
                requestFilterFields.map(({ name }) => name),
              )
            }
          />
          <RequestFiltersDrawer
            initialValues={advancedFilters}
            onApply={(filters) => update(filters)}
            onClear={clearAdvanced}
          />
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                update({}, [
                  "searchAll",
                  "ticket_status_name",
                  ...requestFilterFields.map(({ name }) => name),
                ])
              }
            >
              Xóa tất cả bộ lọc
            </Button>
          )}
        </div>
        {statuses.isError && (
          <div className="space-y-2 px-4 pb-4">
            <ErrorAlert
              message={`Không tải được trạng thái: ${statuses.error.message}`}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void statuses.refetch()}
            >
              Thử lại trạng thái
            </Button>
          </div>
        )}
      </div>

      <section
        aria-label="Kết quả yêu cầu"
        aria-busy={requests.isFetching}
        className="relative flex min-h-112 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:min-h-72"
      >
        {requests.isPending && <LoadingState message="Đang tải yêu cầu..." />}
        {requests.isError && (
          <div className="space-y-3 p-4">
            <ErrorAlert
              message={`Không tải được yêu cầu: ${requests.error.message}`}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void requests.refetch()}
              >
                Thử lại
              </Button>
              {params.page > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => update({ page: 1 })}
                >
                  Về trang đầu
                </Button>
              )}
            </div>
          </div>
        )}
        {!requests.isPending && !requests.isError && requests.data && (
          <>
            {requests.data.results.length ? (
              <RequestTable rows={requests.data.results} />
            ) : (
              <EmptyState
                title="Không tìm thấy yêu cầu"
                description="Thử thay đổi từ khóa hoặc bộ lọc để tìm yêu cầu phù hợp."
                icon={<Inbox className="size-6" aria-hidden="true" />}
                className="rounded-none border-0 shadow-none"
              />
            )}
            {requests.data.results.length > 0 && (
              <RequestPagination
                count={requests.data.count}
                params={params}
                disabled={requests.isPlaceholderData || requests.isFetching}
                onPage={(page) => update({ page })}
                onPageSize={(size) => update({ page_size: size })}
              />
            )}
          </>
        )}
        {requests.isFetching && !requests.isPending && (
          <LoadingState
            message="Đang cập nhật danh sách..."
            className="absolute inset-0 z-20 bg-card/80"
          />
        )}
      </section>
    </div>
  );
}
