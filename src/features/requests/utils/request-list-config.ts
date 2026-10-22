import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { DataFilterField } from "@/components/data-management";
import {
  allRequestFilterFields,
  approvalRequestFilterFields,
  requestFilterFields,
  personalTaskFilterFields,
  allTaskFilterFields,
  type RequestFilters,
  type RequestListScope,
} from "../types";

interface RequestListConfig {
  label: string;
  endpoint:
    | typeof API_ENDPOINTS.tickets.list
    | typeof API_ENDPOINTS.tickets.all
    | typeof API_ENDPOINTS.tickets.personalTasks
    | typeof API_ENDPOINTS.tickets.allTasks;
  typeView?: "create" | "pendingAccept" | "accepted";
  statusKey: "ticket_status_name" | "ticket_status";
  excludeInitialStatus: boolean;
  filterFields: readonly DataFilterField<keyof RequestFilters>[];
  typeSource?: "all" | "handling";
  typeValue?: "id" | "name";
  teams?: boolean;
  allowViews?: boolean;
}

const createdConfig: RequestListConfig = {
  label: "Danh sách yêu cầu",
  endpoint: API_ENDPOINTS.tickets.list,
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
    endpoint: API_ENDPOINTS.tickets.all,
    statusKey: "ticket_status",
    excludeInitialStatus: true,
    filterFields: allRequestFilterFields,
    typeSource: "all",
    typeValue: "id",
    allowViews: true,
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
  "personal-tasks": {
    label: "Nhiệm vụ cá nhân",
    endpoint: API_ENDPOINTS.tickets.personalTasks,
    statusKey: "ticket_status",
    excludeInitialStatus: true,
    filterFields: personalTaskFilterFields,
    typeSource: "handling",
    typeValue: "name",
    teams: true,
    allowViews: true,
  },
  "all-tasks": {
    label: "Tất cả nhiệm vụ",
    endpoint: API_ENDPOINTS.tickets.allTasks,
    statusKey: "ticket_status",
    excludeInitialStatus: true,
    filterFields: allTaskFilterFields,
    typeSource: "handling",
    typeValue: "id",
    teams: true,
    allowViews: true,
  },
};
