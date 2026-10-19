import {
  requestFilterFields,
  requestPageSizes,
  type RequestListParams,
} from "../types";

export function parseRequestListParams(
  search: URLSearchParams,
): RequestListParams {
  const page = Number(search.get("page"));
  const pageSize = Number(search.get("page_size"));
  const params: RequestListParams = {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    page_size:
      requestPageSizes.find((size) => size === pageSize) ?? requestPageSizes[0],
  };
  for (const field of requestFilterFields) {
    const value = search.get(field.name)?.trim();
    if (value) params[field.name] = value;
  }
  const searchAll = search.get("searchAll")?.trim();
  const status = search.get("ticket_status_name")?.trim();
  if (searchAll) params.searchAll = searchAll;
  if (status && status !== "all") params.ticket_status_name = status;
  return params;
}
