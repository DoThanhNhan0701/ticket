import { postRequest } from "@/lib/api/client";
import { parseApiResponse } from "@/lib/api/response-schema";
import {
  changeRequestStatusRequestSchema,
  changeRequestStatusResponseSchema,
  type ChangeRequestStatusRequest,
  type ChangeRequestStatusResponse,
} from "../schemas/change-request-status-schema";

export async function changeRequestStatusRequest(
  values: ChangeRequestStatusRequest,
): Promise<ChangeRequestStatusResponse> {
  const body = parseApiResponse(
    changeRequestStatusRequestSchema,
    values,
    "Thông tin chuyển trạng thái không hợp lệ.",
  );
  const response = await postRequest<unknown>("/change_status_ticket/", {
    body,
  });
  const result = parseApiResponse(
    changeRequestStatusResponseSchema,
    response,
    "Dữ liệu chuyển trạng thái không hợp lệ.",
  );
  if (result.error.trim()) throw new Error(result.error);
  return result;
}
