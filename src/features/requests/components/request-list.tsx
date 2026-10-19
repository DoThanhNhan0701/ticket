import { useQuery } from "@tanstack/react-query";
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
  listAllRequestsRequest,
  listRequestTypesRequest,
} from "../api/requests-api";
import { requestPageSizes, type RequestListScope } from "../types";
import { parseRequestListParams } from "../utils/request-list-params";
import {
  getRequestFilterFields,
  getRequestStatusOptions,
} from "../utils/request-list-options";
import { RequestTable } from "./request-table";

export function RequestList({
  scope = "created",
}: Readonly<{ scope?: RequestListScope }>) {
  const { userId } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = parseRequestListParams(searchParams, scope);
  const types = useQuery({
    queryKey: ["request-types", userId],
    queryFn: ({ signal }) => listRequestTypesRequest(signal),
    enabled: scope === "all",
    retry: false,
  });
  const filterFields = getRequestFilterFields(
    scope,
    types.data ?? [],
    types.isPending,
    params.ticket_type_id,
  );
  const filterNames = filterFields.map(({ name }) => name);
  const statusKey = scope === "all" ? "ticket_status" : "ticket_status_name";
  const selectedStatus = params[statusKey];
  const advancedFilters = getFilterValues(filterFields, params);
  const hasAdvancedFilters = countActiveFilters(filterFields, params) > 0;
  const hasFilters = Boolean(
    params.searchAll || selectedStatus || hasAdvancedFilters || params.typeView,
  );

  const requests = useQuery({
    queryKey: ["requests", scope, userId, params],
    queryFn: ({ signal }) =>
      scope === "all"
        ? listAllRequestsRequest(params, signal)
        : listRequestsRequest(params, signal),
    placeholderData: (previous, query) =>
      query?.queryKey[1] === scope && query.queryKey[2] === userId
        ? previous
        : undefined,
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
  const clearAdvanced = () => update({}, filterNames);
  const statusOptions = getRequestStatusOptions(
    statuses.data ?? [],
    selectedStatus,
    scope,
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <div className="shrink-0 space-y-3">
        <div className="flex flex-wrap items-end gap-2 sm:items-center sm:gap-3">
          <DataSearch
            label="Tìm kiếm yêu cầu"
            resetKey={JSON.stringify(params)}
            initialValue={params.searchAll ?? ""}
            filter={{
              label: "Trạng thái",
              initialValue: selectedStatus ?? "all",
              options: statusOptions,
              loading: statuses.isPending,
            }}
            actions={
              <DataFiltersDrawer
                fields={filterFields}
                description="Lọc yêu cầu theo các thông tin bên dưới."
                initialValues={advancedFilters}
                onApply={(filters) => update(filters)}
                onClear={clearAdvanced}
              />
            }
            onSearch={(value, status) =>
              update(
                {
                  searchAll: value,
                  [statusKey]: status === "all" ? undefined : status,
                },
                filterNames,
              )
            }
          />
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() =>
                update({}, ["searchAll", statusKey, "typeView", ...filterNames])
              }
            >
              Xóa lọc
            </Button>
          )}
        </div>
        {statuses.isError && (
          <div className="space-y-2">
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
        {scope === "all" && types.isError && (
          <div className="space-y-2">
            <ErrorAlert
              message={`Không tải được loại yêu cầu: ${types.error.message}`}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void types.refetch()}
            >
              Thử lại loại yêu cầu
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
            scope={scope}
            rows={rows}
            scrollResetKey={JSON.stringify(params)}
            rowOffset={(params.page - 1) * params.page_size}
          />
        )}
      />
    </div>
  );
}
