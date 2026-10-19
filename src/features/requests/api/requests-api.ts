import { getRequest } from "@/lib/api/client";
import { parseApiResponse } from "@/lib/api/response-schema";
import {
  requestListResponseSchema,
  requestStatusesResponseSchema,
  requestTypesResponseSchema,
  requestTeamsResponseSchema,
} from "../schemas/requests-schema";
import type {
  RequestListParams,
  RequestListResponse,
  RequestListScope,
  RequestStatus,
  RequestType,
  RequestTeam,
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
  // ticketV2 serializes selected tag IDs as an Axios array parameter.
  if (scope === "all-tasks" && params.type_option) {
    params["type_option[]"] = params.type_option;
    delete params.type_option;
  }
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
  source: "all" | "handling" = "all",
): Promise<RequestType[]> {
  const endpoint =
    source === "handling"
      ? "/list_handling_tickettype/"
      : "/list_handling_alltickettype/";
  const response = await getRequest<unknown>(endpoint, {
    signal,
  });
  return parseApiResponse(
    requestTypesResponseSchema,
    response,
    "Dữ liệu loại yêu cầu không hợp lệ.",
  );
}

export async function listRequestTeamsRequest(
  signal?: AbortSignal,
): Promise<RequestTeam[]> {
  const response = await getRequest<unknown>("/list_team/", { signal });
  return parseApiResponse(
    requestTeamsResponseSchema,
    response,
    "Dữ liệu Team không hợp lệ.",
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
