import { getRequest } from "@/lib/api/client";
import { parseApiResponse } from "@/lib/api/response-schema";
import {
  requestListResponseSchema,
  requestStatusesResponseSchema,
} from "../schemas/requests-schema";
import type {
  RequestListParams,
  RequestListResponse,
  RequestStatus,
} from "../types";

export async function listRequestsRequest(
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
  // This page always lists the current user's created requests, as in ticketV2.
  params.typeView = "create";
  const response = await getRequest<unknown>("/list_ticket/", {
    params,
    signal,
  });
  return parseApiResponse(
    requestListResponseSchema,
    response,
    "Dữ liệu danh sách yêu cầu không hợp lệ.",
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
