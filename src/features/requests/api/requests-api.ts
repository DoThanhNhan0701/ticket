import { getRequest } from "@/lib/api/client";
import { parseApiResponse } from "@/lib/api/response-schema";
import {
  requestListResponseSchema,
  requestStatusesResponseSchema,
  requestTypesResponseSchema,
} from "../schemas/requests-schema";
import type {
  RequestListParams,
  RequestListResponse,
  RequestListScope,
  RequestStatus,
  RequestType,
} from "../types";
import { requestListConfig } from "../utils/request-list-config";

export async function listRequestsRequest(
  filters: RequestListParams,
  signal?: AbortSignal,
  scope: Exclude<RequestListScope, "all"> = "created",
): Promise<RequestListResponse> {
  return fetchRequestList(scope, filters, signal);
}

export async function listAllRequestsRequest(
  filters: RequestListParams,
  signal?: AbortSignal,
): Promise<RequestListResponse> {
  return fetchRequestList("all", filters, signal);
}

async function fetchRequestList(
  scope: RequestListScope,
  filters: RequestListParams,
  signal?: AbortSignal,
): Promise<RequestListResponse> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && String(value).trim() !== "")
      params[key] = String(value);
  }
  // The backend requires ordering parameters, even without interactive sorting.
  params.columnSort = "id";
  params.typeSort = "descend";
  // Fixed views belong to the page and cannot be overridden by URL filters.
  const config = requestListConfig[scope];
  if (config.typeView) params.typeView = config.typeView;
  const response = await getRequest<unknown>(config.endpoint, {
    params,
    signal,
  });
  return parseApiResponse(
    requestListResponseSchema,
    response,
    "Dữ liệu danh sách yêu cầu không hợp lệ.",
  );
}

export async function listRequestTypesRequest(
  signal?: AbortSignal,
): Promise<RequestType[]> {
  const response = await getRequest<unknown>("/list_handling_alltickettype/", {
    signal,
  });
  return parseApiResponse(
    requestTypesResponseSchema,
    response,
    "Dữ liệu loại yêu cầu không hợp lệ.",
  );
}

export async function listRequestStatusesRequest(
  signal?: AbortSignal,
): Promise<RequestStatus[]> {
  const response = await getRequest<unknown>("/list_ticketstatus/", { signal });
  return parseApiResponse(
    requestStatusesResponseSchema,
    response,
    "Dữ liệu trạng thái yêu cầu không hợp lệ.",
  ).results;
}
