import { t } from "@/i18n";
// The API builds ticket codes as <handling group name>_YYMMDD_001.
export const MAX_REQUEST_GROUP_NAME_LENGTH = 30 - "_YYMMDD_001".length;

export function getRequestGroupNameError(name: string) {
  if (Array.from(name).length <= MAX_REQUEST_GROUP_NAME_LENGTH) return "";
  return t(
    "request-detail",
    "Tên bộ phận xử lý quá dài để tạo mã yêu cầu. Vui lòng chọn bộ phận khác hoặc rút gọn tên còn tối đa {0} ký tự trong Cấu hình hệ thống.",
    [MAX_REQUEST_GROUP_NAME_LENGTH],
  );
}
