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
export function canEditTicketField(
  field: TemplateField,
  { creator, processor }: { creator: boolean; processor: boolean },
) {
  return processor
    ? (creator && Boolean(field.editable)) || !field.editable
    : Boolean(field.editable);
}
export function sectionUpdateRows(
  ticket: RequestDetailData,
  section: number,
  rows: DetailRow[],
) {
  const groups = ticket.data_item?.dataform.header ?? [];
  const fields = detailFields(groups).filter(
    (field) => field.groupIndex === section,
  );
  return rows.map((row, index) => ({
    key: ticket.data_item?.dataform.data[index]?.key ?? index + 1,
    ...Object.fromEntries(
      fields.map((field) => [fieldDataKey(field), detailValue(field, row)]),
    ),
  }));
}
