import { t } from "@/i18n";
import type { z } from "zod";
import type { DataFilterField } from "@/components/data-management";
import type {
  requestTicketSchema,
  requestStatusSchema,
  requestListResponseSchema,
  requestStatusesResponseSchema,
  requestTypeSchema,
  requestTeamSchema,
} from "./schemas/requests-schema";

export type RequestTicket = z.infer<typeof requestTicketSchema>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type RequestType = z.infer<typeof requestTypeSchema>;
export type RequestTeam = z.infer<typeof requestTeamSchema>;
export type RequestListScope =
  "created" | "all" | "pending" | "approved" | "personal-tasks" | "all-tasks";
export type RequestListResponse = z.infer<typeof requestListResponseSchema>;
export type RequestStatusesResponse = z.infer<
  typeof requestStatusesResponseSchema
>;

export const requestFilterFields = [
  {
    name: "ticket_code",
    get label() {
      return t("request-detail", "Mã yêu cầu");
    },
    get placeholder() {
      return t("request-detail", "Nhập mã yêu cầu");
    },
  },
  {
    name: "ticket_type_name",
    get label() {
      return t("request-detail", "Loại yêu cầu");
    },
    get placeholder() {
      return t("request-detail", "Nhập loại yêu cầu");
    },
  },
  {
    name: "title",
    get label() {
      return t("request-detail", "Tiêu đề");
    },
    get placeholder() {
      return t("request-detail", "Nhập tiêu đề");
    },
  },
  {
    name: "vanphong_name",
    get label() {
      return t("request-detail", "Văn phòng");
    },
    get placeholder() {
      return t("request-detail", "Nhập tên văn phòng");
    },
  },
  {
    name: "duedate",
    get label() {
      return t("request-detail", "Ngày mong muốn");
    },
    placeholder: "DD/MM/YYYY",
    type: "date",
  },
  {
    name: "approve_user_name",
    get label() {
      return t("request-detail", "Người phê duyệt");
    },
    get placeholder() {
      return t("request-detail", "Nhập người phê duyệt");
    },
  },
  {
    name: "updating_user_name",
    get label() {
      return t("request-detail", "Cập nhật bởi");
    },
    get placeholder() {
      return t("request-detail", "Nhập người cập nhật");
    },
  },
] as const satisfies readonly DataFilterField[];

export type RequestFilters = Partial<
  Record<
    | (typeof requestFilterFields)[number]["name"]
    | "ticket_type_id"
    | "list_user_received"
    | "username_create"
    | "bophansudung_name"
    | "team_id"
    | "created_from"
    | "created_to"
    | "typeView"
    | "type_option",
    string
  >
>;

export const allRequestFilterFields = requestFilterFields.map(
  (field): DataFilterField<keyof RequestFilters> => {
    if (field.name === "ticket_type_name")
      return {
        name: "ticket_type_id",
        get label() {
          return field.label;
        },
        get placeholder() {
          return t("request-detail", "Chọn loại yêu cầu");
        },
        type: "select",
        searchable: true,
      };
    if (field.name === "approve_user_name")
      return {
        name: "list_user_received",
        get label() {
          return t("request-detail", "Người xử lý");
        },
        get placeholder() {
          return t("request-detail", "Nhập người xử lý");
        },
      };
    return field;
  },
);

export const approvalRequestFilterFields = requestFilterFields.map(
  (field): DataFilterField<keyof RequestFilters> =>
    field.name === "approve_user_name"
      ? {
          name: "username_create",
          get label() {
            return t("request-detail", "Người yêu cầu");
          },
          get placeholder() {
            return t("request-detail", "Nhập người yêu cầu");
          },
        }
      : field,
);

export const allRequestViews = [
  {
    value: "all",
    get label() {
      return t("request-detail", "Tất cả");
    },
  },
  {
    value: "processing",
    get label() {
      return t("request-detail", "Đang xử lý");
    },
  },
  {
    value: "handle",
    get label() {
      return t("request-detail", "Cần xử lý");
    },
  },
  {
    value: "accepted",
    get label() {
      return t("request-detail", "Đã duyệt");
    },
  },
  {
    value: "received",
    get label() {
      return t("request-detail", "Đã tiếp nhận");
    },
  },
] as const;

export const personalTaskFilterFields: readonly DataFilterField<
  keyof RequestFilters
>[] = [
  ...requestFilterFields.map((field): DataFilterField<keyof RequestFilters> =>
    field.name === "ticket_type_name"
      ? {
          ...field,
          get label() {
            return field.label;
          },
          get placeholder() {
            return t("request-detail", "Chọn loại yêu cầu");
          },
          type: "select",
          searchable: true,
        }
      : field,
  ),
  {
    name: "bophansudung_name",
    get label() {
      return t("common", "Department");
    },
    get placeholder() {
      return t("request-detail", "Nhập Department");
    },
  },
  {
    name: "team_id",
    get label() {
      return t("common", "Team");
    },
    get placeholder() {
      return t("request-detail", "Chọn Team");
    },
    type: "multi-select",
  },
  {
    name: "created_from",
    get label() {
      return t("request-detail", "Ngày tạo từ");
    },
    placeholder: "DD/MM/YYYY",
    type: "date",
  },
  {
    name: "created_to",
    get label() {
      return t("request-detail", "Ngày tạo đến");
    },
    placeholder: "DD/MM/YYYY",
    type: "date",
  },
  {
    name: "typeView",
    get label() {
      return t("request-detail", "Nhóm nhiệm vụ");
    },
    get placeholder() {
      return t("request-detail", "Chọn nhóm nhiệm vụ");
    },
    type: "select",
    searchable: true,
    get options() {
      return allRequestViews.map(({ value, label }) => ({
        value: value === "all" ? "" : value,
        label,
      }));
    },
  },
];

export const allTaskFilterFields: readonly DataFilterField<
  keyof RequestFilters
>[] = [
  ...personalTaskFilterFields.map(
    (field): DataFilterField<keyof RequestFilters> => {
      if (field.name === "ticket_type_name")
        return {
          ...field,
          name: "ticket_type_id",
          get label() {
            return field.label;
          },
          get placeholder() {
            return field.placeholder;
          },
        };
      if (field.name === "approve_user_name")
        return {
          name: "list_user_received",
          get label() {
            return t("request-detail", "Người xử lý");
          },
          get placeholder() {
            return t("request-detail", "Nhập người xử lý");
          },
        };
      return field;
    },
  ),
  {
    name: "type_option",
    get label() {
      return t("request-detail", "Gắn thẻ");
    },
    get placeholder() {
      return t("request-detail", "Chọn phạm vi gắn thẻ");
    },
    type: "select",
    searchable: true,
    options: [
      {
        value: "",
        get label() {
          return t("request-detail", "Tất cả nhiệm vụ");
        },
      },
      {
        value: "0",
        get label() {
          return t("request-detail", "Được gắn thẻ");
        },
      },
    ],
  },
];

export const requestPageSizes = [100, 200] as const;

export interface RequestListParams extends RequestFilters {
  page: number;
  page_size: number;
  searchAll?: string;
  ticket_status_name?: string;
  ticket_status?: string;
  typeView?: Exclude<(typeof allRequestViews)[number]["value"], "all">;
}
