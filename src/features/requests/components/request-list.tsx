import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  DataSearch,
  DataFiltersDrawer,
  DataResults,
  getFilterValues,
  countActiveFilters,
  updateListSearchParams,
} from "@/components/data-management";
import { ErrorAlert } from "@/components/error-alert";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import {
  listRequestsRequest,
  listRequestStatusesRequest,
} from "../api/requests-api";
import { requestFilterFields, requestPageSizes } from "../types";
import { parseRequestListParams } from "../utils/request-list-params";
import { RequestTable } from "./request-table";

export function RequestList() {
  const { userId } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = parseRequestListParams(searchParams);
  const advancedFilters = getFilterValues(requestFilterFields, params);
  const hasAdvancedFilters =
    countActiveFilters(requestFilterFields, params) > 0;
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
    setSearchParams((current) =>
      updateListSearchParams(current, values, [
        "columnSort",
        "typeSort",
        ...remove,
      ]),
    );
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
          <DataSearch
            label="Tìm kiếm yêu cầu"
            key={JSON.stringify(params)}
            initialValue={params.searchAll ?? ""}
            filter={{
              label: "Trạng thái",
              initialValue: params.ticket_status_name ?? "all",
              options: statusOptions,
              loading: statuses.isPending,
            }}
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
          <DataFiltersDrawer
            fields={requestFilterFields}
            description="Lọc yêu cầu theo các thông tin bên dưới."
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

      <DataResults
        query={requests}
        label="Kết quả yêu cầu"
        loadingMessage="Đang tải yêu cầu..."
        errorPrefix="Không tải được yêu cầu"
        emptyTitle="Không tìm thấy yêu cầu"
        emptyDescription="Thử thay đổi từ khóa hoặc bộ lọc để tìm yêu cầu phù hợp."
        pagination={{
          page: params.page,
          pageSize: params.page_size,
          pageSizes: requestPageSizes,
          itemLabel: "yêu cầu",
          onPage: (page) => update({ page }),
          onPageSize: (size) => update({ page_size: size }),
        }}
        renderRows={(rows) => (
          <RequestTable
            rows={rows}
            rowOffset={(params.page - 1) * params.page_size}
          />
        )}
      />
    </div>
  );
}
