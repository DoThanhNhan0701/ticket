import { getRequest, postRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/api-error";
import {
  requestDetailSchema,
  ticketHistorySchema,
} from "../schemas/request-detail-schema";

export function validTicketId(id: string) {
  return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
}
export async function getRequestDetail(id: string, signal?: AbortSignal) {
  if (!validTicketId(id)) throw new Error("Mã yêu cầu không hợp lệ.");
  const response = await getRequest<unknown>(`/ticket_manager/${id}`, {
    signal,
  });
  if (
    response &&
    typeof response === "object" &&
    "message" in response &&
    response.message === "You do not have access"
  )
    throw new ApiError("Bạn không có quyền xem yêu cầu này.", 403);
  const parsed = requestDetailSchema.safeParse(response);
  if (!parsed.success)
    throw new Error("Dữ liệu chi tiết yêu cầu không hợp lệ. Vui lòng tải lại.");
  return parsed.data;
}
export async function getTicketHistory(id: number, signal?: AbortSignal) {
  return ticketHistorySchema.parse(
    await getRequest("/list_ticket_history/", {
      params: { ticket_id: String(id) },
      signal,
    }),
  );
}
function assertSaved(result: unknown) {
  if (result && typeof result === "object" && "error" in result && result.error)
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Không thể lưu thay đổi.",
    );
}
export { addTicketComment } from "./ticket-discussion-api";
export async function updateTicketSection(
  id: number,
  header: unknown,
  data: readonly Record<string, unknown>[],
) {
  assertSaved(
    await postRequest("/edit_item_data/", {
      body: {
        ticket_id: id,
        formDataTicket: { dataform: { header: [header], data } },
      },
    }),
  );
}
