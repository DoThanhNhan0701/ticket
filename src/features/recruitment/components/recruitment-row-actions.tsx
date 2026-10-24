import { t, useLocale } from "@/i18n";
import { useState, type ComponentProps, type ReactNode } from "react";
import {
  CalendarPlus,
  Clock3,
  Eye,
  Ellipsis,
  FilePenLine,
  FilePlus2,
  FileX2,
  Files,
  Pencil,
  RefreshCw,
  Trash2,
  UserRoundMinus,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogCloseButton,
} from "@/components/ui/dialog";
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

const actionHints: Partial<Record<RecruitmentAction, string>> = {
  get request() {
    return t("recruitment", "Xem thông tin và cập nhật yêu cầu tuyển dụng");
  },
  get "create-candidate"() {
    return t("recruitment", "Thêm ứng viên vào yêu cầu tuyển dụng này");
  },
  get note() {
    return t("recruitment", "Ghi chú phỏng vấn và đính kèm tệp");
  },
  get "view-candidate"() {
    return t("recruitment", "Xem thông tin và lịch sử ứng viên");
  },
  get candidate() {
    return t("recruitment", "Sửa thông tin cá nhân và tệp CV");
  },
  get status() {
    return t("recruitment", "Chuyển trạng thái CV và nhập lý do");
  },
  get "candidate-time"() {
    return t("recruitment", "Đặt giờ riêng cho ứng viên trong lịch này");
  },
  get "remove-interview-cv"() {
    return t(
      "recruitment",
      "Bỏ ứng viên khỏi lịch này, giữ lại hồ sơ và trạng thái CV",
    );
  },
  get duplicate() {
    return t("recruitment", "Tìm các hồ sơ ứng viên trùng thông tin");
  },
  get attach() {
    return t("recruitment", "Chọn lịch phỏng vấn cho ứng viên");
  },
  get "delete-candidate"() {
    return t("recruitment", "Xóa toàn bộ hồ sơ ứng viên");
  },
  get "delete-file"() {
    return t("recruitment", "Chỉ xóa tệp CV, giữ lại thông tin ứng viên");
  },
};

const requestActions: readonly RowAction[] = [
  {
    action: "request",
    icon: Eye,
    get label() {
      return t("recruitment", "Xem yêu cầu");
    },
  },
  {
    action: "create-candidate",
    icon: FilePlus2,
    get label() {
      return t("recruitment", "Thêm ứng viên");
    },
  },
];
const candidateActions: readonly RowAction[] = [
  {
    action: "candidate",
    icon: Pencil,
    get label() {
      return t("recruitment", "Sửa hồ sơ");
    },
  },
  {
    action: "note",
    icon: FilePenLine,
    get label() {
      return t("recruitment", "Ghi chú");
    },
  },
  {
    action: "status",
    icon: RefreshCw,
    get label() {
      return t("recruitment", "Chuyển trạng thái");
    },
  },
  {
    action: "duplicate",
    icon: Files,
    get label() {
      return t("recruitment", "Kiểm tra trùng");
    },
  },
  {
    action: "attach",
    icon: CalendarPlus,
    get label() {
      return t("recruitment", "Gắn lịch phỏng vấn");
    },
  },
  {
    action: "delete-candidate",
    icon: Trash2,
    get label() {
      return t("recruitment", "Xóa hồ sơ");
    },
  },
];
const interviewActions: readonly RowAction[] = [
  {
    action: "note",
    icon: FilePenLine,
    get label() {
      return t("recruitment", "Ghi chú");
    },
  },
  {
    action: "view-candidate",
    icon: Eye,
    get label() {
      return t("recruitment", "Xem hồ sơ");
    },
  },
];
const interviewManageActions: readonly RowAction[] = [
  {
    action: "status",
    icon: RefreshCw,
    get label() {
      return t("recruitment", "Chuyển trạng thái");
    },
  },
  {
    action: "candidate-time",
    icon: Clock3,
    get label() {
      return t("recruitment", "Đặt giờ");
    },
  },
  {
    action: "remove-interview-cv",
    icon: UserRoundMinus,
    get label() {
      return t("recruitment", "Bỏ khỏi lịch");
    },
  },
  {
    action: "candidate",
    icon: Pencil,
    get label() {
      return t("recruitment", "Sửa hồ sơ");
    },
  },
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
      {
        action: "delete-file",
        icon: FileX2,
        label: t("recruitment", "Xóa tệp CV"),
      },
    ];
  return candidateActions;
}

export function RecruitmentRowActions({
  mode,
  row,
  disabled,
  canManage = false,
  onAction,
  children,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: Readonly<{
  mode: RecruitmentKind | "interview";
  row: RecruitmentRow;
  disabled: boolean;
  canManage?: boolean;
  onAction: (action: RecruitmentAction, row: RecruitmentRow) => void;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}>) {
  useLocale();
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const name = recruitmentText(
    mode === "interview" ? row.first_name : row.code_cv || row.ticket_code,
  );
  return (
    <>
      {!hideTrigger && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("recruitment", "Thao tác {0}", [name])}
          title={t("recruitment", "Thao tác")}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled || !row.id}
          onClick={() => setOpen(true)}
        >
          <Ellipsis aria-hidden="true" className="size-4" />
        </Button>
      )}
      {open && (
        <Dialog
          open={open}
          onOpenChange={(nextOpen, details) => {
            if (nextOpen || details.reason === "close-press") setOpen(nextOpen);
          }}
        >
          <DialogContent className="max-w-3xl overflow-hidden p-1 sm:p-1">
            <div className="max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-lg p-4 sm:p-6">
              <DialogHeader>
                <DialogHeading
                  icon={<Ellipsis aria-hidden="true" />}
                  title={t("recruitment", "Chọn thao tác")}
                  description={name}
                />
                <DialogCloseButton
                  aria-label={t("recruitment", "Đóng chọn thao tác")}
                />
              </DialogHeader>
              <div className="grid gap-2 sm:grid-cols-2">
                {rowActions(mode, row, canManage).map(
                  ({ action, icon: Icon, label }) => (
                    <Button
                      key={action}
                      type="button"
                      variant="outline"
                      className="h-auto min-h-20 items-start justify-start gap-3 whitespace-normal p-3 text-left"
                      aria-label={`${label} ${name}`}
                      disabled={disabled || !row.id}
                      onClick={() => {
                        onAction(action, row);
                      }}
                    >
                      <Icon
                        aria-hidden="true"
                        className={`mt-0.5 size-5 shrink-0 ${action.startsWith("delete-") ? "text-destructive" : "text-primary"}`}
                      />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="block font-medium">{label}</span>
                        <span
                          title={actionHints[action] ?? label}
                          className="block truncate text-xs font-normal leading-relaxed text-muted-foreground"
                        >
                          {actionHints[action] ?? label}
                        </span>
                      </span>
                    </Button>
                  ),
                )}
              </div>
            </div>
          </DialogContent>
          {children}
        </Dialog>
      )}
    </>
  );
}

// Keep the active chooser outside the table so a refresh or removed row cannot
// dismiss it; a missing row simply disables the available actions.
export function RecruitmentActionChooser({
  row,
  rows,
  onClose,
  disabled,
  ...props
}: Readonly<
  Omit<
    ComponentProps<typeof RecruitmentRowActions>,
    "row" | "open" | "onOpenChange" | "hideTrigger"
  > & {
    row: RecruitmentRow | null;
    rows?: RecruitmentRow[];
    onClose: () => void;
  }
>) {
  useLocale();
  if (!row) return null;
  const current = rows?.find((item) => item.id === row.id);
  return (
    <RecruitmentRowActions
      {...props}
      row={current ?? row}
      disabled={disabled || !current}
      open
      hideTrigger
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    />
  );
}
