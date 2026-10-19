import type { z } from "zod";
import type { DataFilterField } from "@/components/data-management";
import type {
  requestTicketSchema,
  requestStatusSchema,
  requestListResponseSchema,
  requestStatusesResponseSchema,
} from "./schemas/requests-schema";

export type RequestTicket = z.infer<typeof requestTicketSchema>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
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
  Record<(typeof requestFilterFields)[number]["name"], string>
>;

export const requestPageSizes = [100, 200] as const;

export interface RequestListParams extends RequestFilters {
  page: number;
  page_size: number;
  searchAll?: string;
  ticket_status_name?: string;
}
