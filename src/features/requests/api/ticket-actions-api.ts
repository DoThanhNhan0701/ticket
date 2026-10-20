import { postRequest } from "@/lib/api/client";
import type { TicketActionStep } from "../utils/ticket-actions";

export async function executeTicketActionStep(step: TicketActionStep) {
  const result = await postRequest<unknown>(step.endpoint, { body: step.body });
  if (!result || typeof result !== "object")
    throw new Error(
      "Phản hồi xử lý yêu cầu không hợp lệ. Vui lòng tải lại để kiểm tra trạng thái.",
    );
  if ("error" in result && result.error)
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Không thể xử lý yêu cầu.",
    );
  if ("message" in result && result.message === "You do not have access")
    throw new Error("Bạn không có quyền thực hiện thao tác này.");
}
