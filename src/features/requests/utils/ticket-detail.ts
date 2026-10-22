import { getApiBaseUrl } from "@/lib/api/api-base-url";
import type { TemplateField } from "@/features/settings/schemas/template-schema";
import type { RequestDetailData } from "../schemas/request-detail-schema";
import {
  detailFields,
  emptyDetailRow,
  detailValue,
} from "./request-detail-data";
import type { DetailRow } from "../schemas/create-request-schema";

export function ticketFileUrl(value: string) {
  if (!value || !/^(https?:\/\/|\/(?!\/))/.test(value)) return undefined;
  const url = new URL(value, window.location.origin);
  // Legacy responses contain an internal HTTP media host. Use the public API media origin.
  if (url.pathname.startsWith("/media/")) {
    const api = new URL(
      getApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
      window.location.origin,
    );
    return new URL(`${url.pathname}${url.search}`, api.origin).href;
  }
  return url.href;
}
export function fieldDataKey(field: TemplateField) {
  return typeof field.dataIndex === "string" ? field.dataIndex : field.title;
}
export function ticketDetailRows(ticket: RequestDetailData): DetailRow[] {
  const groups = ticket.data_item?.dataform.header ?? [];
  return (ticket.data_item?.dataform.data ?? []).map((record) => {
    const row = emptyDetailRow(groups);
    for (const field of detailFields(groups)) {
      const value = String(record[fieldDataKey(field)] ?? "");
      if (field.type === "range-date-text" && !field.option?.length) {
        const [start = "", end = ""] = value.split(" - ");
        row.values[`${field.fieldKey}_start`] = start;
        row.values[`${field.fieldKey}_end`] = end;
      } else row.values[field.fieldKey] = value;
    }
    return row;
  });
}
export function ticketFieldRoles(
  ticket: RequestDetailData,
  { username, userId }: { username: string | null; userId: number | null },
) {
  const assignments = ticket.list_user_received.filter((user) =>
    userId !== null && user.user_id !== null && user.user_id !== undefined
      ? String(user.user_id) === String(userId)
      : Boolean(username && user.username === username),
  );
  return {
    creator: Boolean(username && ticket.username_create === username),
    processor: assignments.length > 0,
    editingProcessor:
      ticket.ticket_status === 3 &&
      assignments.some((user) => user.status === "Đang xử lý"),
  };
}
export function canEditTicketField(
  field: TemplateField,
  { creator, processor }: { creator: boolean; processor: boolean },
) {
  if (field.handling === false) return false;
  // Section visibility controls when a section can be edited. Legacy field
  // `editable` values must not override the active handler's change permission.
  return processor || (creator && Boolean(field.editable));
}
export function canViewTicketField(
  field: TemplateField,
  { creator, processor }: { creator: boolean; processor: boolean },
) {
  return field.status !== true || creator || processor;
}
export function sectionUpdateRows(
  ticket: RequestDetailData,
  section: number,
  rows: DetailRow[],
  canEdit?: (field: TemplateField) => boolean,
) {
  const groups = ticket.data_item?.dataform.header ?? [];
  const fields = detailFields(groups).filter(
    (field) => field.groupIndex === section,
  );
  return rows.map((row, index) => ({
    key: ticket.data_item?.dataform.data[index]?.key ?? index + 1,
    ...Object.fromEntries(
      fields.map((field) => [
        fieldDataKey(field),
        !canEdit || canEdit(field)
          ? detailValue(field, row)
          : (ticket.data_item?.dataform.data[index]?.[fieldDataKey(field)] ??
            ""),
      ]),
    ),
  }));
}
