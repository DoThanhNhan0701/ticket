import {
  requestPageSizes,
  allRequestViews,
  type RequestListParams,
  type RequestListScope,
} from "../types";
import {
  parseListPagination,
  readStringFilters,
} from "@/components/data-management";
import { requestListConfig } from "./request-list-config";

export function parseRequestListParams(
  search: URLSearchParams,
  scope: RequestListScope = "created",
): RequestListParams {
  const { page, pageSize } = parseListPagination(search, requestPageSizes);
  const config = requestListConfig[scope];
  const params: RequestListParams = {
    page,
    page_size: pageSize,
    ...readStringFilters(
      search,
      config.filterFields
        .map(({ name }) => name)
        .filter((name) => name !== "typeView"),
    ),
  };
  const searchAll = search.get("searchAll")?.trim();
  if (searchAll) params.searchAll = searchAll;
  if (config.statusKey === "ticket_status") {
    params.ticket_status = readIdFilter(search, "ticket_status");
  } else {
    const status = search.get("ticket_status_name")?.trim();
    if (status && status !== "all") params.ticket_status_name = status;
  }
  if (config.typeValue === "id")
    params.ticket_type_id = readIdFilter(search, "ticket_type_id");
  if (config.allowViews) {
    const view = allRequestViews.find(
      ({ value }) => value === search.get("typeView"),
    );
    params.typeView = view?.value === "all" ? undefined : view?.value;
  }
  if (config.teams) params.team_id = readTeamIds(search.get("team_id"));
  if (scope === "all-tasks")
    params.type_option = search.get("type_option") === "0" ? "0" : undefined;
  return params;
}

function readIdFilter(
  search: URLSearchParams,
  key: string,
): string | undefined {
  const value = search.get(key)?.trim();
  return value &&
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value))
    ? value
    : undefined;
}

function readTeamIds(value: string | null) {
  const ids = value?.split(",").map((id) => id.trim());
  if (
    !ids?.length ||
    ids.some(
      (id) => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)),
    )
  )
    return undefined;
  return [...new Set(ids)].join(",");
}
