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
    | "/accept_ticket/"
    | "/receive_ticket/"
    | "/assignment_ticket/"
    | "/delete_assignment_ticket/"
    | "/change_assignment_ticket/"
    | "/done_ticket/"
    | "/close_ticket/"
    | "/cancel_ticket/"
    | "/reprocess_ticket/"
    | "/forward_ticket/"
    | "/attachmentticketfile";
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
        endpoint: "/assignment_ticket/",
        body: {
          ...base,
          ls_user_assignment: requireUsers(values.users, available),
        },
      },
    ];
  if (values.mode === "change")
    return [
      {
        endpoint: "/change_assignment_ticket/",
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
      endpoint: "/delete_assignment_ticket/",
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
            endpoint: "/assignment_ticket/",
            body: {
              ...base,
              ls_user_assignment: requireUsers(values.replacements, available),
            },
          }
        : {
            endpoint: "/done_ticket/",
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
        endpoint: "/forward_ticket/",
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
    "Phê duyệt": "/accept_ticket/",
    "Tiếp nhận": "/receive_ticket/",
    "Hoàn thành": "/done_ticket/",
    Đóng: "/close_ticket/",
    Hủy: "/cancel_ticket/",
    "Xử lý lại": "/reprocess_ticket/",
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
      steps.push({ endpoint: "/attachmentticketfile", body: upload });
    }
  steps.push({ endpoint: endpoints[action], body });
  return steps;
}
