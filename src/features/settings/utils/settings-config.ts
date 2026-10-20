import type { SettingsConfig, SettingsKind } from "../types";

const nameField = (label: string) => ({
  name: "name" as const,
  label,
  required: true,
});
export const settingsConfig: Record<SettingsKind, SettingsConfig> = {
  users: {
    label: "người dùng",
    listEndpoint: "/list_user_v2/",
    writeEndpoint: "/usermmanager/",
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
    listEndpoint: "/list_bophan_sudung/",
    writeEndpoint: "/bophanmmanager/",
    paginated: true,
    fields: [nameField("Tên bộ phận")],
  },
  "handling-departments": {
    label: "bộ phận xử lý",
    listEndpoint: "/list_handling_group/",
    writeEndpoint: "/handlinggroupmmanager/",
    paginated: true,
    fields: [
      nameField("Tên bộ phận"),
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
    listEndpoint: "/list_ticket_type/",
    writeEndpoint: "/tickettypemmanager/",
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
    listEndpoint: "/list_team/",
    writeEndpoint: "/teammanager/",
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
    listEndpoint: "/list_chucvu/",
    writeEndpoint: "/chucvumanager/",
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
    listEndpoint: "/list_vanphong/",
    writeEndpoint: "/vanphongmanager/",
    paginated: false,
    fields: [nameField("Tên văn phòng")],
  },
};
export function getSettingsKind(path: string): SettingsKind | undefined {
  return (Object.keys(settingsConfig) as SettingsKind[]).find(
    (kind) => path === `/settings/${kind}`,
  );
}
