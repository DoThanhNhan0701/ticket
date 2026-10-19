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

export async function listRequestsRequest(
  filters: RequestListParams,
  signal?: AbortSignal,
): Promise<RequestListResponse> {
  return fetchRequestList("created", filters, signal);
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
  // Preserve ticketV2's scopes: the all endpoint omits typeView for all records.
  if (scope === "created") params.typeView = "create";
  const endpoint =
    scope === "all" ? "/list_ticket_all_SupAD/" : "/list_ticket/";
  const response = await getRequest<unknown>(endpoint, {
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
