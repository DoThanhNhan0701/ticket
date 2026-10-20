const excelTypes = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "application/zip",
]);

export function parseSpreadsheet(response: unknown): Blob {
  if (
    response instanceof Blob &&
    response.size > 0 &&
    excelTypes.has(response.type.split(";")[0])
  )
    return response;
  if (typeof response === "object" && response !== null && "status" in response)
    throw new Error("Không có dữ liệu để xuất trong khoảng thời gian đã chọn.");
  throw new Error("Tệp Excel nhận được không hợp lệ.");
}
