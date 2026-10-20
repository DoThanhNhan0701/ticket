export function assertTicketSaved(result: unknown) {
  if (!result || typeof result !== "object")
    throw new Error(
      "Phản hồi không hợp lệ. Vui lòng tải lại để kiểm tra kết quả.",
    );
  if ("error" in result && result.error)
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Không thể lưu thay đổi.",
    );
  if ("message" in result && result.message === "You do not have access")
    throw new Error("Bạn không có quyền thực hiện thao tác này.");
}
