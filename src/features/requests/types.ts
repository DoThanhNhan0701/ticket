import type { z } from "zod";
import type { DataFilterField } from "@/components/data-management";
import type {
  requestTicketSchema,
  requestStatusSchema,
  requestListResponseSchema,
  requestStatusesResponseSchema,
  requestTypeSchema,
} from "./schemas/requests-schema";

export type RequestTicket = z.infer<typeof requestTicketSchema>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type RequestType = z.infer<typeof requestTypeSchema>;
export type RequestListScope = "created" | "all";
export type RequestListResponse = z.infer<typeof requestListResponseSchema>;
export type RequestStatusesResponse = z.infer<
  typeof requestStatusesResponseSchema
>;

export const requestFilterFields = [
  { name: "ticket_code", label: "Mã yêu cầu", placeholder: "Nhập mã yêu cầu" },
  {
    name: "ticket_type_name",
    label: "Loại yêu cầu",
    placeholder: "Nhập loại yêu cầu",
  },
  { name: "title", label: "Tiêu đề", placeholder: "Nhập tiêu đề" },
  {
    name: "vanphong_name",
    label: "Văn phòng",
    placeholder: "Nhập tên văn phòng",
  },
  {
    name: "duedate",
    label: "Ngày mong muốn",
    placeholder: "DD/MM/YYYY",
    type: "date",
  },
  {
    name: "approve_user_name",
    label: "Người phê duyệt",
    placeholder: "Nhập người phê duyệt",
  },
  {
    name: "updating_user_name",
    label: "Cập nhật bởi",
    placeholder: "Nhập người cập nhật",
  },
] as const satisfies readonly DataFilterField[];

export type RequestFilters = Partial<
  Record<
    | (typeof requestFilterFields)[number]["name"]
    | "ticket_type_id"
    | "list_user_received",
    string
  >
>;

export const allRequestFilterFields = requestFilterFields.map(
  (field): DataFilterField<keyof RequestFilters> => {
    if (field.name === "ticket_type_name")
      return {
        name: "ticket_type_id",
        label: field.label,
        placeholder: "Chọn loại yêu cầu",
        type: "select",
        searchable: true,
      };
    if (field.name === "approve_user_name")
      return {
        name: "list_user_received",
        label: "Người xử lý",
        placeholder: "Nhập người xử lý",
      };
    return field;
  },
);

export const allRequestViews = [
  { value: "all", label: "Tất cả" },
  { value: "processing", label: "Đang xử lý" },
  { value: "handle", label: "Cần xử lý" },
  { value: "accepted", label: "Đã duyệt" },
  { value: "received", label: "Đã tiếp nhận" },
] as const;

export const requestPageSizes = [100, 200] as const;

export interface RequestListParams extends RequestFilters {
  page: number;
  page_size: number;
  searchAll?: string;
  ticket_status_name?: string;
  ticket_status?: string;
  typeView?: Exclude<(typeof allRequestViews)[number]["value"], "all">;
}
