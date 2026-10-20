import { getRequest, postRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/api-error";
import { format } from "date-fns";
import { parseRequestDate } from "../utils/request-detail-data";
import { assertTicketSaved } from "./ticket-response";
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
export async function updateTicketDueDate(
  id: number,
  value: string,
  previous: string,
) {
  const date = parseRequestDate(value);
  const oldDate = parseRequestDate(previous);
  if (!date || (oldDate && date <= oldDate))
    throw new Error("Ngày mong muốn mới phải sau ngày mong muốn hiện tại.");
  assertTicketSaved(
    await postRequest("/update_duedate/", {
      body: { ticket_id: id, duedate: format(date, "yyyy-MM-dd") },
    }),
  );
}
export { addTicketComment } from "./ticket-discussion-api";
export async function updateTicketSection(
  id: number,
  header: unknown,
  data: readonly Record<string, unknown>[],
) {
  assertTicketSaved(
    await postRequest("/edit_item_data/", {
      body: {
        ticket_id: id,
        formDataTicket: { dataform: { header: [header], data } },
      },
    }),
  );
}
