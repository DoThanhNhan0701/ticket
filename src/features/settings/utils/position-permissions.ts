import { t } from "@/i18n";
import type { SettingsRecord } from "../types";

interface PositionPermissionInfo {
  label: string;
  description: string;
  retired?: boolean;
}

const permissionInfo: Record<string, PositionPermissionInfo> = {
  can_create: {
    get label() {
      return t("settings-positions", "Tạo yêu cầu");
    },
    get description() {
      return t(
        "settings-positions",
        "Tạo yêu cầu mới và sao chép yêu cầu hiện có.",
      );
    },
  },
  can_report: {
    get label() {
      return t("settings-positions", "Xem báo cáo");
    },
    get description() {
      return t(
        "settings-positions",
        "Truy cập trang Báo cáo và xem báo cáo trong phạm vi được cấp.",
      );
    },
  },
  can_system: {
    get label() {
      return t("settings-positions", "Cấu hình hệ thống");
    },
    get description() {
      return t(
        "settings-positions",
        "Truy cập các danh mục cấu hình như người dùng, bộ phận, loại yêu cầu, team, chức vụ và văn phòng.",
      );
    },
  },
  can_view: {
    get label() {
      return t("settings-positions", "Xem yêu cầu");
    },
    get description() {
      return t(
        "settings-positions",
        "Truy cập danh sách yêu cầu của mình, chi tiết yêu cầu và yêu cầu từ email trong phạm vi được cấp.",
      );
    },
  },
  can_search: {
    get label() {
      return t("settings-positions", "Tìm kiếm yêu cầu");
    },
    get description() {
      return t(
        "settings-positions",
        "Tìm kiếm đã tích hợp trong các trang danh sách theo quyền truy cập trang, không cần cấp quyền riêng.",
      );
    },
    retired: true,
  },
  can_accept: {
    get label() {
      return t("settings-positions", "Phê duyệt yêu cầu");
    },
    get description() {
      return t(
        "settings-positions",
        "Truy cập danh sách chờ phê duyệt, đã phê duyệt và duyệt các yêu cầu được giao.",
      );
    },
  },
  can_delete: {
    get label() {
      return t("settings-positions", "Xóa yêu cầu");
    },
    get description() {
      return t(
        "settings-positions",
        "Website hiện không có chức năng xóa ticket. Quyền này ngừng cấp mới; thao tác Hủy yêu cầu vẫn theo quyền xử lý của từng ticket.",
      );
    },
    retired: true,
  },
  can_export: {
    get label() {
      return t("settings-positions", "Xuất dữ liệu");
    },
    get description() {
      return t(
        "settings-positions",
        "Truy cập trang Truy xuất dữ liệu và xuất dữ liệu trong phạm vi được cấp.",
      );
    },
  },
  can_allticket: {
    get label() {
      return t("settings-positions", "Xem tất cả yêu cầu");
    },
    get description() {
      return t(
        "settings-positions",
        "Truy cập trang Tất cả yêu cầu trong phạm vi hệ thống cho phép.",
      );
    },
  },
  can_cv_interview: {
    get label() {
      return t("settings-positions", "Xem hồ sơ phỏng vấn");
    },
    get description() {
      return t(
        "settings-positions",
        "Xem hồ sơ ứng viên gắn với lịch phỏng vấn được cấp quyền.",
      );
    },
  },
  can_return_ticket: {
    get label() {
      return t("settings-positions", "Chuyển trạng thái yêu cầu");
    },
    get description() {
      return t(
        "settings-positions",
        "Truy cập trang Chuyển trạng thái yêu cầu để cập nhật trạng thái theo mã yêu cầu.",
      );
    },
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
        description:
          description || t("settings-positions", "Quyền do hệ thống cung cấp."),
      };
}

export function formatPositionPermissionName(name: string): string {
  const info = getPositionPermissionInfo(name);
  return info.retired
    ? t("settings-positions", "{0} (Ngừng cấp mới)", [info.label])
    : info.label;
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
