import type { DataFilterField } from "@/components/data-management";
import {
  allRequestFilterFields,
  approvalRequestFilterFields,
  requestFilterFields,
  type RequestFilters,
  type RequestListScope,
} from "../types";

interface RequestListConfig {
  label: string;
  endpoint: "/list_ticket/" | "/list_ticket_all_SupAD/";
  typeView?: "create" | "pendingAccept" | "accepted";
  statusKey: "ticket_status_name" | "ticket_status";
  excludeInitialStatus: boolean;
  filterFields: readonly DataFilterField<keyof RequestFilters>[];
}

const createdConfig: RequestListConfig = {
  label: "Danh sách yêu cầu",
  endpoint: "/list_ticket/",
  typeView: "create",
  statusKey: "ticket_status_name",
  excludeInitialStatus: false,
  filterFields: requestFilterFields,
};

export const requestListConfig: Readonly<
  Record<RequestListScope, RequestListConfig>
> = {
  created: createdConfig,
  all: {
    label: "Tất cả yêu cầu",
    endpoint: "/list_ticket_all_SupAD/",
    statusKey: "ticket_status",
    excludeInitialStatus: true,
    filterFields: allRequestFilterFields,
  },
  pending: {
    ...createdConfig,
    label: "Chờ phê duyệt",
    typeView: "pendingAccept",
    filterFields: approvalRequestFilterFields,
  },
  approved: {
    ...createdConfig,
    label: "Đã phê duyệt",
    typeView: "accepted",
    excludeInitialStatus: true,
    filterFields: approvalRequestFilterFields,
  },
};
