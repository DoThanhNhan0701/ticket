import {
  CalendarPlus,
  Clock3,
  Eye,
  FilePenLine,
  FilePlus2,
  Files,
  Pencil,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  RecruitmentAction,
  RecruitmentKind,
  RecruitmentRow,
} from "../types";
import { recruitmentText } from "../utils/recruitment-format";

interface RowAction {
  action: RecruitmentAction;
  icon: LucideIcon;
  label: string;
}

const requestActions: readonly RowAction[] = [
  { action: "request", icon: Eye, label: "Xem yêu cầu" },
  { action: "create-candidate", icon: FilePlus2, label: "Thêm ứng viên" },
];
const candidateActions: readonly RowAction[] = [
  { action: "candidate", icon: Pencil, label: "Sửa hồ sơ" },
  { action: "status", icon: RefreshCw, label: "Chuyển trạng thái" },
  { action: "duplicate", icon: Files, label: "Kiểm tra trùng" },
  { action: "attach", icon: CalendarPlus, label: "Gắn lịch phỏng vấn" },
  { action: "delete-candidate", icon: Trash2, label: "Xóa hồ sơ" },
];
const interviewActions: readonly RowAction[] = [
  { action: "note", icon: FilePenLine, label: "Ghi chú" },
  { action: "view-candidate", icon: Eye, label: "Xem hồ sơ" },
];
const interviewManageActions: readonly RowAction[] = [
  { action: "candidate-time", icon: Clock3, label: "Đặt giờ" },
  { action: "remove-interview-cv", icon: Trash2, label: "Bỏ khỏi lịch" },
  { action: "candidate", icon: Pencil, label: "Sửa hồ sơ" },
];

function rowActions(
  mode: RecruitmentKind | "interview",
  row: RecruitmentRow,
  canManage: boolean,
): readonly RowAction[] {
  if (mode === "requests") return requestActions;
  if (mode === "interview")
    return canManage
      ? [...interviewActions, ...interviewManageActions]
      : interviewActions;
  if (row.name_file_cv)
    return [
      ...candidateActions,
      { action: "delete-file", icon: Trash2, label: "Xóa tệp CV" },
    ];
  return candidateActions;
}

export function RecruitmentRowActions({
  mode,
  row,
  disabled,
  canManage = false,
  onAction,
}: Readonly<{
  mode: RecruitmentKind | "interview";
  row: RecruitmentRow;
  disabled: boolean;
  canManage?: boolean;
  onAction: (action: RecruitmentAction, row: RecruitmentRow) => void;
}>) {
  const name = recruitmentText(
    mode === "interview" ? row.first_name : row.code_cv || row.ticket_code,
  );
  return (
    <div className="flex items-center gap-1">
      {rowActions(mode, row, canManage).map(({ action, icon: Icon, label }) => (
        <Button
          key={action}
          type="button"
          variant="outline"
          size="icon"
          aria-label={`${label} ${name}`}
          title={label}
          disabled={disabled || !row.id}
          onClick={() => onAction(action, row)}
        >
          <Icon className="size-4" aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}
