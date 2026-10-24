import { t, useLocale } from "@/i18n";
import { ErrorToast } from "@/components/error-toast";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import {
  Check,
  CheckCheck,
  CircleCheck,
  CircleX,
  Forward,
  LockKeyhole,
  RotateCcw,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { localizedToast as toast } from "@/i18n/toast";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogFooter,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { ErrorAlert } from "@/components/error-alert";
import { SelectField } from "@/components/form/select-field";
import { TextareaField } from "@/components/form/textarea-field";
import type { RequestDetailData } from "../schemas/request-detail-schema";
import { executeTicketActionStep } from "../api/ticket-actions-api";
import {
  actionReasonLabel,
  availableTicketActions,
  availableUsers,
  assignmentModes,
  buildTicketActionPlan,
  type TicketAction,
  type TicketActionOperation,
  type TicketActionValues,
  type TicketActionStep,
} from "../utils/ticket-actions";
import { TicketAssignmentFields } from "./ticket-assignment-fields";
import { RequestAttachments } from "./request-attachments";
import { usePendingAttachments } from "../hooks/use-pending-attachments";

const icons: Record<TicketAction, LucideIcon> = {
  "Phê duyệt": Check,
  "Tiếp nhận": CheckCheck,
  "Phân công": UserPlus,
  "Hoàn thành": CircleCheck,
  Đóng: LockKeyhole,
  Hủy: CircleX,
  "Xử lý lại": RotateCcw,
};
const actionDescriptions: Record<TicketActionOperation, string> = {
  get "Phê duyệt"() {
    return t(
      "request-actions",
      "Phê duyệt để yêu cầu được chuyển sang bước xử lý.",
    );
  },
  get "Tiếp nhận"() {
    return t(
      "request-actions",
      "Xác nhận tiếp nhận yêu cầu theo quy trình của bộ phận xử lý.",
    );
  },
  get "Phân công"() {
    return t("request-actions", "Thêm, thay thế hoặc gỡ người xử lý yêu cầu.");
  },
  get "Hoàn thành"() {
    return t(
      "request-actions",
      "Xác nhận bạn đã hoàn tất phần việc được giao.",
    );
  },
  get Đóng() {
    return t(
      "request-actions",
      "Đóng yêu cầu sau khi đã kiểm tra kết quả xử lý.",
    );
  },
  get Hủy() {
    return t("request-actions", "Nhập lý do để hủy yêu cầu này.");
  },
  get "Xử lý lại"() {
    return t("request-actions", "Nhập lý do để yêu cầu được xử lý lại.");
  },
  get "Chuyển tiếp"() {
    return t("request-actions", "Chọn người nhận để chuyển tiếp yêu cầu.");
  },
};
const actionColors: Record<TicketAction, string> = {
  "Phê duyệt":
    "border-success-border bg-success-soft text-success hover:border-success hover:bg-success-soft hover:text-success",
  "Tiếp nhận":
    "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:bg-blue-900 dark:hover:text-blue-200",
  "Phân công":
    "border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-400 hover:bg-brand-100 hover:text-brand-800 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-200 dark:hover:border-brand-500 dark:hover:bg-brand-900 dark:hover:text-brand-100",
  "Hoàn thành":
    "border-success-border bg-success-soft text-success hover:border-success hover:bg-success-soft hover:text-success",
  Đóng: "border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400 hover:bg-slate-200 hover:text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200",
  Hủy: "border-danger-border bg-danger-soft text-destructive hover:border-destructive hover:bg-danger-soft hover:text-destructive",
  "Xử lý lại":
    "border-warning-border bg-warning-soft text-warning hover:border-warning hover:bg-warning-soft hover:text-warning",
};
export function TicketActions({
  ticket,
  onSaved,
}: Readonly<{
  ticket: RequestDetailData;
  onSaved: () => Promise<unknown>;
}>) {
  useLocale();
  const [action, setAction] = useState<TicketAction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshAfterSave = async () => {
    setRefreshing(true);
    try {
      await onSaved();
    } finally {
      setRefreshing(false);
    }
  };
  const actions = availableTicketActions(ticket);
  if (!actions.length) return null;
  return (
    <>
      <div
        role="group"
        className="flex flex-wrap justify-end gap-2"
        aria-label={t("request-actions", "Thao tác yêu cầu")}
        aria-busy={refreshing}
      >
        {actions.map((name) => {
          const Icon = icons[name];
          return (
            <Button
              key={name}
              type="button"
              variant="outline"
              size="sm"
              mobileIconOnly
              title={t("request-actions", name)}
              disabled={refreshing}
              className={`gap-1.5 ${actionColors[name]}`}
              onClick={() => setAction(name)}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t("request-actions", name)}
            </Button>
          );
        })}
      </div>
      {action && (
        <TicketActionDialog
          key={`${ticket.id}-${action}`}
          ticket={ticket}
          action={action}
          onClose={() => setAction(null)}
          onSaved={refreshAfterSave}
        />
      )}
    </>
  );
}
function actionDialogClass(
  action: TicketAction,
  reasonLabel: string | undefined,
  forward: boolean,
) {
  return action === "Phân công" || reasonLabel || forward
    ? "max-w-xl shadow-xl"
    : "max-w-md shadow-xl";
}

function actionSubmitVariant(action: TicketAction) {
  return action === "Hủy" ? "destructive" : "default";
}

function TicketActionSummary({
  ticket,
  operation,
}: Readonly<{ ticket: RequestDetailData; operation: string }>) {
  useLocale();
  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-4">
      <p
        id="ticket-action-description"
        className="text-sm leading-relaxed text-muted-foreground"
      >
        {" "}
        {t("request-actions", "Xác nhận")}{" "}
        {t("request-actions", operation).toLowerCase()}{" "}
        {t("request-actions", "yêu cầu")}{" "}
        <strong className="font-semibold text-foreground wrap-anywhere">
          {ticket.ticket_code || `#${ticket.id}`}
        </strong>
        .
      </p>
      {ticket.title && (
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap wrap-anywhere">
          {ticket.title}
        </p>
      )}
    </div>
  );
}

function TicketActionDialog({
  ticket,
  action,
  onClose,
  onSaved,
}: Readonly<{
  ticket: RequestDetailData;
  action: TicketAction;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}>) {
  useLocale();
  const [forward, setForward] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  usePendingAttachments(files.length);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(0);
  const plan = useRef<TicketActionStep[] | null>(null);
  const progress = useRef(0);
  const submitting = useRef(false);
  const operation = forward ? "Chuyển tiếp" : action;
  const ActionIcon = forward ? Forward : icons[action];
  const available = availableUsers(ticket);
  const form = useForm<TicketActionValues>({
    defaultValues: {
      reason: "",
      mode:
        assignmentModes(ticket).find((option) => !option.disabled)?.value ?? "",
      users: [],
      oldUser: "",
      newUser: "",
      replacements: [],
    },
  });
  const mutation = useMutation({
    retry: false,
    mutationFn: async (steps: TicketActionStep[]) => {
      while (progress.current < steps.length) {
        await executeTicketActionStep(steps[progress.current]);
        progress.current += 1;
        setCompleted(progress.current);
      }
    },
    onSuccess: async () => {
      const refresh = onSaved();
      onClose();
      toast.success(
        t("request-actions", "Đã thực hiện: {0}.", [
          t("request-actions", operation),
        ]),
      );
      try {
        await refresh;
      } catch {
        toast.error(
          t(
            "request-actions",
            "Đã lưu thao tác. Vui lòng tải lại để xem trạng thái mới.",
          ),
        );
      }
    },
    onError: () => {
      if (progress.current === 0) plan.current = null;
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  const locked = mutation.isPending || completed > 0;
  const close = () => {
    if (completed > 0)
      void onSaved().catch(() =>
        toast.error(
          t("request-actions", "Vui lòng tải lại để xem trạng thái mới."),
        ),
      );
    onClose();
  };
  const reasonLabel = actionReasonLabel(operation, ticket.ticket_status);
  const submit = (values: TicketActionValues) => {
    if (submitting.current) return;
    try {
      if (!plan.current)
        plan.current = buildTicketActionPlan(ticket, operation, values, files);
      submitting.current = true;
      setError("");
      mutation.mutate(plan.current);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("request-actions", "Thông tin không hợp lệ."),
      );
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) close();
      }}
    >
      <DialogContent
        className={actionDialogClass(action, reasonLabel, forward)}
        aria-describedby="ticket-action-help ticket-action-description"
      >
        <DialogHeader>
          <DialogHeading
            icon={<ActionIcon aria-hidden="true" />}
            iconClassName={actionColors[forward ? "Tiếp nhận" : action]}
            title={t("request-actions", "{0} yêu cầu", [
              t("request-actions", operation),
            ])}
            description={actionDescriptions[operation]}
            descriptionId="ticket-action-help"
          />
          <DialogCloseButton
            disabled={mutation.isPending}
            aria-label={t("request-actions", "Đóng thao tác yêu cầu")}
          />
        </DialogHeader>
        <form
          aria-label={t("request-actions", "{0} yêu cầu", [
            t("request-actions", operation),
          ])}
          noValidate
          className="min-w-0 space-y-4"
          onSubmit={form.handleSubmit(submit)}
        >
          <TicketActionSummary ticket={ticket} operation={operation} />
          {action === "Phân công" && (
            <TicketAssignmentFields
              ticket={ticket}
              form={form}
              disabled={locked}
            />
          )}
          {reasonLabel && (
            <TextareaField
              control={form.control}
              name="reason"
              id="ticket-action-reason"
              label={reasonLabel}
              placeholder={t("request-actions", "Nhập lý do")}
              disabled={locked}
              required
            />
          )}
          {forward && (
            <SelectField
              control={form.control}
              name="newUser"
              id="ticket-forward-user"
              label={t("request-actions", "Người nhận chuyển tiếp")}
              options={available}
              searchable
              disabled={locked}
              required
            />
          )}
          {action === "Hủy" && (
            <RequestAttachments
              files={files}
              onChange={setFiles}
              disabled={locked}
            />
          )}
          {error && <ErrorAlert message={error} />}
          {mutation.isError && <ErrorToast message={mutation.error.message} />}
          {completed > 0 && mutation.isError && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("request-actions", "Đã lưu")} {completed}{" "}
              {t(
                "request-actions",
                "bước. Thử lại để tiếp tục phần còn lại; các bước đã lưu sẽ không được gửi lại.",
              )}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={close}
            >
              {t("request-actions", "Thoát")}
            </Button>
            {action === "Hoàn thành" && available.length > 0 && (
              <Button
                type="button"
                variant="outline"
                disabled={locked}
                onClick={() => {
                  setForward(!forward);
                  setError("");
                  mutation.reset();
                  plan.current = null;
                }}
              >
                <Forward className="size-4" aria-hidden="true" />
                {forward
                  ? t("request-actions", "Quay lại")
                  : t("request-actions", "Chuyển tiếp")}
              </Button>
            )}
            <AsyncButton
              type="submit"
              variant={actionSubmitVariant(action)}
              className="shadow-xs"
              loading={mutation.isPending}
              loadingText={t("request-actions", "Đang xử lý...")}
              icon={<ActionIcon className="size-4" aria-hidden="true" />}
            >
              {mutation.isError && completed > 0
                ? t("request-actions", "Thử lại phần còn lại")
                : t("request-actions", operation)}
            </AsyncButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
