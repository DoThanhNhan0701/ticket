import {
  requestFilterFields,
  requestPageSizes,
  type RequestListParams,
} from "../types";
import {
  parseListPagination,
  readStringFilters,
} from "@/components/data-management";

export function parseRequestListParams(
  search: URLSearchParams,
): RequestListParams {
  const { page, pageSize } = parseListPagination(search, requestPageSizes);
  const params: RequestListParams = {
    page,
    page_size: pageSize,
    ...readStringFilters(
      search,
      requestFilterFields.map(({ name }) => name),
    ),
  };
  const searchAll = search.get("searchAll")?.trim();
  const status = search.get("ticket_status_name")?.trim();
  if (searchAll) params.searchAll = searchAll;
  if (status && status !== "all") params.ticket_status_name = status;
  return params;
}
