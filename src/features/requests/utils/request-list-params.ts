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
  const params: RequestListParams = {
    page,
    page_size: pageSize,
    ...readStringFilters(
      search,
      requestListConfig[scope].filterFields.map(({ name }) => name),
    ),
  };
  const searchAll = search.get("searchAll")?.trim();
  if (searchAll) params.searchAll = searchAll;
  if (scope === "all") {
    Object.assign(params, readAllRequestControls(search));
  } else {
    const status = search.get("ticket_status_name")?.trim();
    if (status && status !== "all") params.ticket_status_name = status;
  }
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

function readAllRequestControls(search: URLSearchParams) {
  const view = allRequestViews.find(
    ({ value }) => value === search.get("typeView"),
  );
  return {
    ticket_status: readIdFilter(search, "ticket_status"),
    ticket_type_id: readIdFilter(search, "ticket_type_id"),
    typeView: view?.value === "all" ? undefined : view?.value,
  };
}
