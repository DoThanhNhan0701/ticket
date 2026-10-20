// The API builds ticket codes as <handling group name>_YYMMDD_001.
export const MAX_REQUEST_GROUP_NAME_LENGTH = 30 - "_YYMMDD_001".length;

export function getRequestGroupNameError(name: string) {
  if (Array.from(name).length <= MAX_REQUEST_GROUP_NAME_LENGTH) return "";
  return `Tên bộ phận xử lý quá dài để tạo mã yêu cầu. Vui lòng chọn bộ phận khác hoặc rút gọn tên còn tối đa ${MAX_REQUEST_GROUP_NAME_LENGTH} ký tự trong Cấu hình hệ thống.`;
}
