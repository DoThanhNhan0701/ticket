import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { RequestDetailData } from "../schemas/request-detail-schema";

export const ticketActionNames = [
  "Phê duyệt",
  "Tiếp nhận",
  "Phân công",
  "Hoàn thành",
  "Đóng",
  "Hủy",
  "Xử lý lại",
] as const;
export type TicketAction = (typeof ticketActionNames)[number];
export type TicketActionOperation = TicketAction | "Chuyển tiếp";
export interface TicketActionValues {
  reason: string;
  mode: string;
  users: string[];
  oldUser: string;
  newUser: string;
  replacements: string[];
}
export interface TicketActionStep {
  endpoint:
    | typeof API_ENDPOINTS.tickets.accept
    | typeof API_ENDPOINTS.tickets.receive
    | typeof API_ENDPOINTS.tickets.assign
    | typeof API_ENDPOINTS.tickets.deleteAssignment
    | typeof API_ENDPOINTS.tickets.changeAssignment
    | typeof API_ENDPOINTS.tickets.done
    | typeof API_ENDPOINTS.tickets.close
    | typeof API_ENDPOINTS.tickets.cancel
    | typeof API_ENDPOINTS.tickets.reprocess
    | typeof API_ENDPOINTS.tickets.forward
    | typeof API_ENDPOINTS.tickets.attachment;
  body: Record<string, unknown> | FormData;
}
export function availableTicketActions(ticket: RequestDetailData) {
  return ticketActionNames.filter((action) =>
    Object.prototype.hasOwnProperty.call(ticket.list_button, action),
  );
}
export function processingUsers(ticket: RequestDetailData) {
  return ticket.list_user_received.filter(
    (user) =>
      user.status === "Đang xử lý" &&
      user.user_id !== null &&
      user.user_id !== undefined,
  );
}
export function availableUsers(ticket: RequestDetailData) {
  return Object.entries(ticket.list_user_not_received)
    .filter(([, id]) => /^\d+$/.test(String(id)) && Number(id) > 0)
    .map(([label, id]) => ({ label, value: String(id) }));
}
export function assignmentModes(ticket: RequestDetailData) {
  const available = availableUsers(ticket);
  const current = processingUsers(ticket);
  return [
    ...(available.length
      ? [{ value: "add", label: "Thêm người xử lý", disabled: false }]
      : []),
    {
      value: "delete",
      label: "Xóa người xử lý",
      disabled: !current.length || ticket.list_user_received.length <= 1,
    },
    {
      value: "change",
      label: "Thay đổi người xử lý",
      disabled: !current.length || !available.length,
    },
  ];
}
export function actionReasonLabel(
  action: TicketActionOperation,
  status: number,
) {
  if (action === "Hủy") return "Lý do hủy yêu cầu";
  if (action === "Xử lý lại") return "Lý do xử lý lại";
  if (action === "Hoàn thành" && status === 6) return "Lý do không xử lý lại";
  return "";
}
function requireReason(reason: string) {
  if (!reason.trim()) throw new Error("Vui lòng nhập lý do.");
  return reason.trim();
}
function requireUsers(selected: string[], options: { value: string }[]) {
  if (
    !selected.length ||
    !selected.every((id) => options.some((option) => option.value === id))
  )
    throw new Error("Vui lòng chọn người xử lý hợp lệ.");
  return [...new Set(selected)].map(Number);
}
function assignmentPlan(
  ticket: RequestDetailData,
  values: TicketActionValues,
): TicketActionStep[] {
  const base = { ticket_id: ticket.id };
  const current = processingUsers(ticket).map((user) => ({
    value: String(user.user_id),
  }));
  const available = availableUsers(ticket);
  if (values.mode === "add")
    return [
      {
        endpoint: API_ENDPOINTS.tickets.assign,
        body: {
          ...base,
          ls_user_assignment: requireUsers(values.users, available),
        },
      },
    ];
  if (values.mode === "change")
    return [
      {
        endpoint: API_ENDPOINTS.tickets.changeAssignment,
        body: {
          ...base,
          user_assignment_old: requireUsers([values.oldUser], current)[0],
          user_assignment: requireUsers([values.newUser], available)[0],
          lydothaydoinguoixuly: requireReason(values.reason),
        },
      },
    ];
  if (values.mode !== "delete")
    throw new Error("Vui lòng chọn loại phân công.");
  const users = requireUsers(values.users, current);
  if (users.length >= ticket.list_user_received.length)
    throw new Error(
      "Yêu cầu phải có ít nhất một người xử lý. Hãy thay đổi người xử lý hoặc hoàn thành yêu cầu.",
    );
  const steps: TicketActionStep[] = [
    {
      endpoint: API_ENDPOINTS.tickets.deleteAssignment,
      body: {
        ...base,
        ls_user_delete: users,
        lydoxoanguoixuly: requireReason(values.reason),
      },
    },
  ];
  if (users.length === current.length) {
    steps.push(
      values.replacements.length
        ? {
            endpoint: API_ENDPOINTS.tickets.assign,
            body: {
              ...base,
              ls_user_assignment: requireUsers(values.replacements, available),
            },
          }
        : {
            endpoint: API_ENDPOINTS.tickets.done,
            body: { ...base, is_manage_done: true },
          },
    );
  }
  return steps;
}
export function buildTicketActionPlan(
  ticket: RequestDetailData,
  action: TicketActionOperation,
  values: TicketActionValues,
  files: readonly File[] = [],
): TicketActionStep[] {
  const requiredAction = action === "Chuyển tiếp" ? "Hoàn thành" : action;
  if (!availableTicketActions(ticket).includes(requiredAction))
    throw new Error(
      "Bạn không còn quyền thực hiện thao tác này. Vui lòng tải lại yêu cầu.",
    );
  if (action === "Phân công") return assignmentPlan(ticket, values);
  if (action === "Chuyển tiếp")
    return [
      {
        endpoint: API_ENDPOINTS.tickets.forward,
        body: {
          ticket_id: ticket.id,
          user_forward: requireUsers(
            [values.newUser],
            availableUsers(ticket),
          )[0],
        },
      },
    ];
  const endpoints = {
    "Phê duyệt": API_ENDPOINTS.tickets.accept,
    "Tiếp nhận": API_ENDPOINTS.tickets.receive,
    "Hoàn thành": API_ENDPOINTS.tickets.done,
    Đóng: API_ENDPOINTS.tickets.close,
    Hủy: API_ENDPOINTS.tickets.cancel,
    "Xử lý lại": API_ENDPOINTS.tickets.reprocess,
  } as const;
  const body: Record<string, unknown> = { ticket_id: ticket.id };
  if (actionReasonLabel(action, ticket.ticket_status)) {
    const keys = {
      Hủy: "lydohuyyeucau",
      "Xử lý lại": "lydoxulylai",
      "Hoàn thành": "lydokhongxulylai",
    };
    body[keys[action as keyof typeof keys]] = requireReason(values.reason);
  }
  const steps: TicketActionStep[] = [];
  if (action === "Hủy")
    for (const file of files) {
      if (file.size > 50 * 1024 * 1024)
        throw new Error(`Tệp “${file.name}” vượt quá 50 MB.`);
      const upload = new FormData();
      upload.append("ticket_id", String(ticket.id));
      upload.append("att_file", file);
      steps.push({ endpoint: API_ENDPOINTS.tickets.attachment, body: upload });
    }
  steps.push({ endpoint: endpoints[action], body });
  return steps;
}
