import type { SettingsRecord } from "../types";

interface PositionPermissionInfo {
  label: string;
  description: string;
  retired?: boolean;
}

const permissionInfo: Record<string, PositionPermissionInfo> = {
  can_create: {
    label: "Tạo yêu cầu",
    description: "Tạo yêu cầu mới và sao chép yêu cầu hiện có.",
  },
  can_report: {
    label: "Xem báo cáo",
    description:
      "Truy cập trang Báo cáo và xem báo cáo trong phạm vi được cấp.",
  },
  can_system: {
    label: "Cấu hình hệ thống",
    description:
      "Truy cập các danh mục cấu hình như người dùng, bộ phận, loại yêu cầu, team, chức vụ và văn phòng.",
  },
  can_view: {
    label: "Xem yêu cầu",
    description:
      "Truy cập danh sách yêu cầu của mình, chi tiết yêu cầu và yêu cầu từ email trong phạm vi được cấp.",
  },
  can_search: {
    label: "Tìm kiếm yêu cầu",
    description:
      "Tìm kiếm đã tích hợp trong các trang danh sách theo quyền truy cập trang, không cần cấp quyền riêng.",
    retired: true,
  },
  can_accept: {
    label: "Phê duyệt yêu cầu",
    description:
      "Truy cập danh sách chờ phê duyệt, đã phê duyệt và duyệt các yêu cầu được giao.",
  },
  can_delete: {
    label: "Xóa yêu cầu",
    description:
      "Website hiện không có chức năng xóa ticket. Quyền này ngừng cấp mới; thao tác Hủy yêu cầu vẫn theo quyền xử lý của từng ticket.",
    retired: true,
  },
  can_export: {
    label: "Xuất dữ liệu",
    description:
      "Truy cập trang Truy xuất dữ liệu và xuất dữ liệu trong phạm vi được cấp.",
  },
  can_allticket: {
    label: "Xem tất cả yêu cầu",
    description:
      "Truy cập trang Tất cả yêu cầu trong phạm vi hệ thống cho phép.",
  },
  can_cv_interview: {
    label: "Xem hồ sơ phỏng vấn",
    description: "Xem hồ sơ ứng viên gắn với lịch phỏng vấn được cấp quyền.",
  },
  can_return_ticket: {
    label: "Chuyển trạng thái yêu cầu",
    description:
      "Truy cập trang Chuyển trạng thái yêu cầu để cập nhật trạng thái theo mã yêu cầu.",
  },
};

export function getPositionPermissionInfo(
  name: string,
  description?: string | null,
): PositionPermissionInfo {
  return Object.prototype.hasOwnProperty.call(permissionInfo, name)
    ? permissionInfo[name]
    : {
        label: name,
        description: description || "Quyền do hệ thống cung cấp.",
      };
}

export function formatPositionPermissionName(name: string): string {
  const info = getPositionPermissionInfo(name);
  return info.retired ? `${info.label} (Ngừng cấp mới)` : info.label;
}

export function getPositionPermissionOptions(
  rows: readonly SettingsRecord[],
  selected: readonly string[],
) {
  return rows
    .filter(
      (row) =>
        selected.includes(String(row.id)) ||
        (row.is_active && !getPositionPermissionInfo(row.name).retired),
    )
    .map((row) => ({
      value: String(row.id),
      label: formatPositionPermissionName(row.name),
    }));
}
