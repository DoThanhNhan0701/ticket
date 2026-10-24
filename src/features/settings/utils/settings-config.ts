import { t } from "@/i18n";
import { MAX_REQUEST_GROUP_NAME_LENGTH } from "@/features/requests/utils/request-code";
import { APP_ROUTES } from "@/constants/routes";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { SettingsConfig, SettingsKind } from "../types";

const nameField = (
  label: string,
  namespace = "settings",
  maxLength?: number,
) => ({
  maxLength,
  name: "name" as const,
  get label() {
    return t(namespace, label);
  },
  required: true,
});
export const settingsConfig: Record<SettingsKind, SettingsConfig> = {
  users: {
    get label() {
      return t("settings-users", "người dùng");
    },
    listEndpoint: API_ENDPOINTS.lookups.users,
    writeEndpoint: API_ENDPOINTS.settings.users,
    paginated: false,
    listLookups: ["requesting-departments", "teams", "positions"],
    fields: [
      {
        name: "username",
        get label() {
          return t("settings-users", "Tên đăng nhập");
        },
        required: true,
      },
      {
        name: "msnv",
        get label() {
          return t("settings-users", "Mã số nhân viên");
        },
        required: true,
        createOnly: true,
      },
      {
        name: "last_name",
        get label() {
          return t("settings-users", "Họ");
        },
        required: true,
      },
      {
        name: "first_name",
        get label() {
          return t("settings-users", "Tên");
        },
        required: true,
      },
      { name: "email", label: "Email", type: "email", required: true },
      {
        name: "bophan",
        get label() {
          return t("common", "Department");
        },
        type: "select",
        lookup: "requesting-departments",
      },
      {
        name: "team",
        get label() {
          return t("common", "Team");
        },
        type: "select",
        lookup: "teams",
        required: true,
      },
      {
        name: "chucvu",
        get label() {
          return t("settings-users", "Chức vụ");
        },
        type: "select",
        lookup: "positions",
        required: true,
      },
      {
        name: "nhomquyen",
        get label() {
          return t("settings-users", "Nhóm quyền bổ sung");
        },
        type: "select",
        lookup: "permission-groups",
      },
    ],
  },
  "requesting-departments": {
    get label() {
      return t("settings-requesting-departments", "bộ phận sử dụng");
    },
    listEndpoint: API_ENDPOINTS.settings.departments,
    writeEndpoint: API_ENDPOINTS.settings.department,
    paginated: true,
    fields: [nameField("Tên bộ phận", "settings-requesting-departments", 30)],
  },
  "handling-departments": {
    get label() {
      return t("settings-handling-departments", "bộ phận xử lý");
    },
    listEndpoint: API_ENDPOINTS.lookups.handlingGroups,
    writeEndpoint: API_ENDPOINTS.settings.handlingGroup,
    paginated: true,
    fields: [
      nameField(
        "Tên bộ phận",
        "settings-handling-departments",
        MAX_REQUEST_GROUP_NAME_LENGTH,
      ),
      {
        name: "group_email",
        get label() {
          return t("settings-handling-departments", "Email bộ phận");
        },
        type: "email",
      },
      {
        name: "is_manager",
        get label() {
          return t("settings-handling-departments", "Người quản lý");
        },
        type: "select",
        lookup: "users",
        required: true,
      },
      {
        name: "ls_member",
        get label() {
          return t("settings-handling-departments", "Thành viên");
        },
        type: "multi",
        lookup: "users",
      },
      {
        name: "description",
        get label() {
          return t("settings-handling-departments", "Mô tả");
        },
        type: "textarea",
      },
    ],
  },
  "request-types": {
    get label() {
      return t("settings-request-types", "loại yêu cầu");
    },
    listEndpoint: API_ENDPOINTS.settings.ticketTypes,
    writeEndpoint: API_ENDPOINTS.settings.ticketType,
    paginated: true,
    fields: [
      nameField("Tên loại yêu cầu", "settings-request-types"),
      {
        name: "handling_group",
        get label() {
          return t("settings-request-types", "Bộ phận xử lý");
        },
        type: "select",
        lookup: "handling-departments",
        required: true,
      },
    ],
  },
  teams: {
    get label() {
      return t("settings-teams", "team");
    },
    listEndpoint: API_ENDPOINTS.lookups.teams,
    writeEndpoint: API_ENDPOINTS.settings.team,
    paginated: false,
    listLookups: ["requesting-departments"],
    fields: [
      nameField("Tên team", "settings-teams"),
      {
        name: "bophan",
        get label() {
          return t("common", "Department");
        },
        type: "select",
        lookup: "requesting-departments",
        required: true,
      },
    ],
  },
  positions: {
    get label() {
      return t("settings-positions", "chức vụ");
    },
    listEndpoint: API_ENDPOINTS.settings.positions,
    writeEndpoint: API_ENDPOINTS.settings.position,
    paginated: false,
    listLookups: ["position-permissions"],
    fields: [
      nameField("Tên chức vụ", "settings-positions"),
      {
        name: "description",
        get label() {
          return t("settings-positions", "Mô tả");
        },
        type: "textarea",
      },
      {
        name: "permission",
        get label() {
          return t("settings-positions", "Quyền hạn");
        },
        type: "multi",
        lookup: "position-permissions",
      },
    ],
  },
  offices: {
    get label() {
      return t("settings-offices", "văn phòng");
    },
    listEndpoint: API_ENDPOINTS.settings.offices,
    writeEndpoint: API_ENDPOINTS.settings.office,
    paginated: false,
    fields: [nameField("Tên văn phòng", "settings-offices")],
  },
};
export function getSettingsKind(path: string): SettingsKind | undefined {
  return (Object.keys(settingsConfig) as SettingsKind[]).find(
    (kind) => path === APP_ROUTES.settings[kind],
  );
}
