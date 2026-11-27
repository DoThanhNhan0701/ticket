import { t, translateMessage, useLocale } from "@/i18n";
import { ErrorToast } from "@/components/error-toast";
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
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import {
  listRequestsRequest,
  listRequestStatusesRequest,
  listAllRequestsRequest,
  listRequestTypesRequest,
  listRequestTeamsRequest,
} from "../api/requests-api";
import { requestPageSizes, type RequestListScope } from "../types";
import { parseRequestListParams } from "../utils/request-list-params";
import { requestListConfig } from "../utils/request-list-config";
import {
  getRequestFilterFields,
  getRequestStatusOptions,
} from "../utils/request-list-options";
import { RequestTable } from "./request-table";

export function RequestList({
  scope = "created",
}: Readonly<{ scope?: RequestListScope }>) {
  useLocale();
  const { userId } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = parseRequestListParams(searchParams, scope);
  const config = requestListConfig[scope];
  const types = useQuery({
    queryKey: [
      config.typeSource === "handling"
        ? "handling-request-types"
        : "request-types",
      userId,
    ],
    queryFn: ({ signal }) => listRequestTypesRequest(signal, config.typeSource),
    enabled: Boolean(config.typeSource),
    retry: false,
  });
  const teams = useQuery({
    queryKey: ["request-teams", userId],
    queryFn: ({ signal }) => listRequestTeamsRequest(signal),
    enabled: Boolean(config.teams),
    retry: false,
  });
  const filterFields = getRequestFilterFields(scope, {
    types: types.data ?? [],
    typesLoading: types.isPending,
    selectedType:
      config.typeValue === "name"
        ? params.ticket_type_name
        : params.ticket_type_id,
    teams: teams.data ?? [],
    teamsLoading: teams.isPending,
    selectedTeams: params.team_id,
  });
  const filterNames = filterFields.map(({ name }) => name);
  const searchFilterNames = filterNames.filter(
    (name) => name !== "typeView" && name !== "type_option",
  );
  const statusKey = config.statusKey;
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
        : listRequestsRequest(params, signal, scope),
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
      <div className="contents sm:block sm:shrink-0 sm:space-y-1">
        <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <DataSearch
            mobileFilters={{
              fields: [
                {
                  name: "searchAll",
                  label: t("request-list", "Tìm kiếm yêu cầu"),
                  placeholder: t("request-list", "Nhập từ khóa..."),
                },
                ...filterFields,
              ],
              initialValues: {
                ...advancedFilters,
                searchAll: params.searchAll ?? "",
              },
              activeCount:
                countActiveFilters(filterFields, params) +
                Number(Boolean(params.searchAll)),
              onApply: (filters) => update(filters),
              onClear: () =>
                update({}, ["searchAll", "typeView", ...filterNames]),
            }}
            label={t("request-list", "Tìm kiếm yêu cầu")}
            resetKey={JSON.stringify(params)}
            initialValue={params.searchAll ?? ""}
            actions={
              <DataFiltersDrawer
                fields={filterFields}
                description={t(
                  "request-list",
                  "Lọc yêu cầu theo các thông tin bên dưới.",
                )}
                initialValues={advancedFilters}
                onApply={(filters) => update(filters)}
                onClear={clearAdvanced}
              />
            }
            onSearch={(value) =>
              update({ searchAll: value }, searchFilterNames)
            }
          />
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              className="hidden sm:inline-flex sm:w-auto"
              onClick={() =>
                update({}, ["searchAll", statusKey, "typeView", ...filterNames])
              }
            >
              {t("request-list", "Xóa lọc")}
            </Button>
          )}
        </div>
        <div
          role="group"
          aria-label={t("request-list", "Trạng thái")}
          aria-busy={statuses.isPending}
          className="flex min-w-0 shrink-0 flex-wrap items-center gap-1"
        >
          {statusOptions.map(({ value, label }) => {
            const active = value === (selectedStatus ?? "all");
            return (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                className="h-auto min-h-7 max-w-full whitespace-normal"
                onClick={() => {
                  if (!active)
                    update({
                      [statusKey]: value === "all" ? undefined : value,
                    });
                }}
              >
                {label}
              </Button>
            );
          })}
        </div>
        {statuses.isError && (
          <ErrorToast
            message={t("request-list", "Không tải được trạng thái: {0}", [
              translateMessage(statuses.error.message),
            ])}
          />
        )}
        {config.typeSource && types.isError && (
          <ErrorToast
            message={t("request-list", "Không tải được loại yêu cầu: {0}", [
              translateMessage(types.error.message),
            ])}
          />
        )}
        {config.teams && teams.isError && (
          <ErrorToast
            message={t("request-list", "Không tải được Team: {0}", [
              translateMessage(teams.error.message),
            ])}
          />
        )}
      </div>

      <DataResults
        query={requests}
        loadingTable
        label={t("request-list", "Kết quả yêu cầu")}
        loadingMessage={t("request-list", "Đang tải yêu cầu...")}
        errorPrefix={t("request-list", "Không tải được yêu cầu")}
        emptyTitle={t("request-list", "Không tìm thấy yêu cầu")}
        emptyDescription={t(
          "request-list",
          "Thử thay đổi từ khóa hoặc bộ lọc để tìm yêu cầu phù hợp.",
        )}
        pagination={{
          page: params.page,
          pageSize: params.page_size,
          pageSizes: requestPageSizes,
          itemLabel: t("request-list", "yêu cầu"),
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
