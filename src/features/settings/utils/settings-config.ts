import { MAX_REQUEST_GROUP_NAME_LENGTH } from "@/features/requests/utils/request-code";
import { APP_ROUTES } from "@/constants/routes";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { SettingsConfig, SettingsKind } from "../types";

const nameField = (label: string) => ({
  name: "name" as const,
  label,
  required: true,
});
export const settingsConfig: Record<SettingsKind, SettingsConfig> = {
  users: {
    label: "người dùng",
    listEndpoint: API_ENDPOINTS.lookups.users,
    writeEndpoint: API_ENDPOINTS.settings.users,
    paginated: false,
    listLookups: ["requesting-departments", "teams", "positions"],
    fields: [
      { name: "username", label: "Tên đăng nhập", required: true },
      {
        name: "msnv",
        label: "Mã số nhân viên",
        required: true,
        createOnly: true,
      },
      { name: "last_name", label: "Họ", required: true },
      { name: "first_name", label: "Tên", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      {
        name: "bophan",
        label: "Department",
        type: "select",
        lookup: "requesting-departments",
      },
      {
        name: "team",
        label: "Team",
        type: "select",
        lookup: "teams",
        required: true,
      },
      {
        name: "chucvu",
        label: "Chức vụ",
        type: "select",
        lookup: "positions",
        required: true,
      },
      {
        name: "nhomquyen",
        label: "Nhóm quyền bổ sung",
        type: "select",
        lookup: "permission-groups",
      },
    ],
  },
  "requesting-departments": {
    label: "bộ phận sử dụng",
    listEndpoint: API_ENDPOINTS.settings.departments,
    writeEndpoint: API_ENDPOINTS.settings.department,
    paginated: true,
    fields: [{ ...nameField("Tên bộ phận"), maxLength: 30 }],
  },
  "handling-departments": {
    label: "bộ phận xử lý",
    listEndpoint: API_ENDPOINTS.lookups.handlingGroups,
    writeEndpoint: API_ENDPOINTS.settings.handlingGroup,
    paginated: true,
    fields: [
      { ...nameField("Tên bộ phận"), maxLength: MAX_REQUEST_GROUP_NAME_LENGTH },
      { name: "group_email", label: "Email bộ phận", type: "email" },
      {
        name: "is_manager",
        label: "Người quản lý",
        type: "select",
        lookup: "users",
        required: true,
      },
      {
        name: "ls_member",
        label: "Thành viên",
        type: "multi",
        lookup: "users",
      },
      { name: "description", label: "Mô tả", type: "textarea" },
    ],
  },
  "request-types": {
    label: "loại yêu cầu",
    listEndpoint: API_ENDPOINTS.settings.ticketTypes,
    writeEndpoint: API_ENDPOINTS.settings.ticketType,
    paginated: true,
    fields: [
      nameField("Tên loại yêu cầu"),
      {
        name: "handling_group",
        label: "Bộ phận xử lý",
        type: "select",
        lookup: "handling-departments",
        required: true,
      },
    ],
  },
  teams: {
    label: "team",
    listEndpoint: API_ENDPOINTS.lookups.teams,
    writeEndpoint: API_ENDPOINTS.settings.team,
    paginated: false,
    listLookups: ["requesting-departments"],
    fields: [
      nameField("Tên team"),
      {
        name: "bophan",
        label: "Department",
        type: "select",
        lookup: "requesting-departments",
        required: true,
      },
    ],
  },
  positions: {
    label: "chức vụ",
    listEndpoint: API_ENDPOINTS.settings.positions,
    writeEndpoint: API_ENDPOINTS.settings.position,
    paginated: false,
    listLookups: ["position-permissions"],
    fields: [
      nameField("Tên chức vụ"),
      { name: "description", label: "Mô tả", type: "textarea" },
      {
        name: "permission",
        label: "Quyền hạn",
        type: "multi",
        lookup: "position-permissions",
      },
    ],
  },
  offices: {
    label: "văn phòng",
    listEndpoint: API_ENDPOINTS.settings.offices,
    writeEndpoint: API_ENDPOINTS.settings.office,
    paginated: false,
    fields: [nameField("Tên văn phòng")],
  },
};
export function getSettingsKind(path: string): SettingsKind | undefined {
  return (Object.keys(settingsConfig) as SettingsKind[]).find(
    (kind) => path === APP_ROUTES.settings[kind],
  );
}
