import { z } from "zod";
import type {
  SettingsField,
  SettingsFormValues,
  SettingsKind,
  SettingsLookups,
  SettingsRecord,
} from "../types";
import { settingsConfig } from "./settings-config";
import { getPositionPermissionInfo } from "./position-permissions";

function recordText(
  record: SettingsRecord | undefined,
  key: keyof SettingsRecord,
) {
  const value = record?.[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}
export function getSettingsDefaults(
  record?: SettingsRecord,
): SettingsFormValues {
  return {
    name: recordText(record, "name"),
    username: recordText(record, "username"),
    first_name: recordText(record, "first_name"),
    last_name: recordText(record, "last_name"),
    msnv: recordText(record, "msnv"),
    email: recordText(record, "email"),
    bophan: recordText(record, "bophan"),
    team: recordText(record, "team"),
    chucvu: recordText(record, "chucvu"),
    nhomquyen: String(record?.ls_permission?.[0] ?? ""),
    description: recordText(record, "description"),
    group_email: recordText(record, "group_email"),
    is_manager: recordText(record, "is_manager"),
    ls_member: record?.ls_member?.map(String) ?? [],
    permission: record?.permission?.map(String) ?? [],
    handling_group: recordText(record, "handling_group"),
    is_active: record?.is_active ?? true,
  };
}
const text = z.string().trim().max(255, "Tối đa 255 ký tự.");
const formSchema = z.object({
  name: text,
  username: text,
  first_name: text,
  last_name: text,
  msnv: text,
  email: text,
  bophan: text,
  team: text,
  chucvu: text,
  nhomquyen: text,
  description: z.string(),
  group_email: text,
  is_manager: text,
  ls_member: z.array(z.string()),
  permission: z.array(z.string()),
  handling_group: text,
  is_active: z.boolean(),
});
function validateField(
  field: SettingsField,
  value: string | string[],
  lookups: SettingsLookups,
): string[] {
  const messages: string[] = [];
  if (field.maxLength && value.length > field.maxLength)
    messages.push(`Tối đa ${field.maxLength} ký tự.`);
  if (field.required && !value.length)
    messages.push(
      `Vui lòng ${field.lookup ? "chọn" : "nhập"} ${field.label.toLowerCase()}.`,
    );
  if (field.type === "email" && value && !z.email().safeParse(value).success)
    messages.push("Email không hợp lệ.");
  if (field.lookup) {
    const options = lookups[field.lookup] ?? [];
    const selected = Array.isArray(value) ? value : [value].filter(Boolean);
    if (
      selected.some((id) => !options.some((option) => String(option.id) === id))
    )
      messages.push("Lựa chọn không hợp lệ. Vui lòng chọn lại.");
  }
  return messages;
}
export function getSettingsFormSchema(
  kind: SettingsKind,
  editing: boolean,
  lookups: SettingsLookups,
  record?: SettingsRecord,
) {
  return formSchema.superRefine((values, context) => {
    if (
      kind === "positions" &&
      values.permission.some((id) => {
        const permission = lookups["position-permissions"]?.find(
          (option) => String(option.id) === id,
        );
        return (
          permission &&
          getPositionPermissionInfo(permission.name).retired &&
          !(editing && record?.permission?.includes(permission.id))
        );
      })
    )
      context.addIssue({
        code: "custom",
        path: ["permission"],
        message: "Quyền đã ngừng sử dụng, không thể cấp mới.",
      });
    for (const field of settingsConfig[kind].fields) {
      if (editing && field.createOnly) continue;
      for (const message of validateField(field, values[field.name], lookups))
        context.addIssue({ code: "custom", path: [field.name], message });
    }
  });
}
export function settingsOptions(
  rows: readonly SettingsRecord[],
  selected: string | readonly string[] = "",
) {
  const selectedIds = typeof selected === "string" ? [selected] : selected;
  return rows
    .filter((row) => row.is_active || selectedIds.includes(String(row.id)))
    .map((row) => ({
      value: String(row.id),
      label: row.username ? `${row.username} · ${row.name}` : row.name,
    }));
}
