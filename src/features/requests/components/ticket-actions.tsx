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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  buildTicketActionPlan,
  type TicketAction,
  type TicketActionValues,
  type TicketActionStep,
} from "../utils/ticket-actions";
import { TicketAssignmentFields } from "./ticket-assignment-fields";
import { RequestAttachments } from "./request-attachments";

const icons: Record<TicketAction, LucideIcon> = {
  "Phê duyệt": Check,
  "Tiếp nhận": CheckCheck,
  "Phân công": UserPlus,
  "Hoàn thành": CircleCheck,
  Đóng: LockKeyhole,
  Hủy: CircleX,
  "Xử lý lại": RotateCcw,
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
  const [action, setAction] = useState<TicketAction | null>(null);
  const actions = availableTicketActions(ticket);
  if (!actions.length) return null;
  return (
    <>
      <div
        role="group"
        className="flex flex-wrap justify-end gap-2"
        aria-label="Thao tác yêu cầu"
      >
        {actions.map((name) => {
          const Icon = icons[name];
          return (
            <Button
              key={name}
              type="button"
              variant="outline"
              size="sm"
              className={`gap-1.5 ${actionColors[name]}`}
              onClick={() => setAction(name)}
            >
              <Icon className="size-4" aria-hidden="true" />
              {name}
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
          onSaved={onSaved}
        />
      )}
    </>
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
  const [forward, setForward] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
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
      mode: available.length ? "add" : "delete",
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
      toast.success(`Đã thực hiện: ${operation}.`);
      try {
        await onSaved();
      } catch {
        toast.error("Đã lưu thao tác. Vui lòng tải lại để xem trạng thái mới.");
      }
      onClose();
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
        toast.error("Vui lòng tải lại để xem trạng thái mới."),
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
        cause instanceof Error ? cause.message : "Thông tin không hợp lệ.",
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
        className="max-w-xl"
        aria-describedby="ticket-action-description"
      >
        <DialogHeader>
          <DialogTitle>{operation} yêu cầu</DialogTitle>
          <DialogCloseButton
            disabled={mutation.isPending}
            aria-label="Đóng thao tác yêu cầu"
          />
        </DialogHeader>
        <form
          aria-label={`${operation} yêu cầu`}
          noValidate
          className="min-w-0 space-y-4"
          onSubmit={form.handleSubmit(submit)}
        >
          <p
            id="ticket-action-description"
            className="text-sm text-muted-foreground"
          >
            Xác nhận {operation.toLowerCase()} yêu cầu{" "}
            <strong className="text-foreground">
              {ticket.ticket_code || `#${ticket.id}`}
            </strong>
            .
          </p>
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
              placeholder="Nhập lý do"
              disabled={locked}
              required
            />
          )}
          {forward && (
            <SelectField
              control={form.control}
              name="newUser"
              id="ticket-forward-user"
              label="Người nhận chuyển tiếp"
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
          {mutation.isError && <ErrorAlert message={mutation.error.message} />}
          {completed > 0 && mutation.isError && (
            <p role="status" className="text-sm text-muted-foreground">
              Đã lưu {completed} bước. Thử lại để tiếp tục phần còn lại; các
              bước đã lưu sẽ không được gửi lại.
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={close}
            >
              Thoát
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
                {forward ? "Quay lại" : "Chuyển tiếp"}
              </Button>
            )}
            <AsyncButton
              type="submit"
              variant="outline"
              className={actionColors[forward ? "Tiếp nhận" : action]}
              loading={mutation.isPending}
              loadingText="Đang xử lý..."
              icon={<ActionIcon className="size-4" aria-hidden="true" />}
            >
              {mutation.isError && completed > 0
                ? "Thử lại phần còn lại"
                : operation}
            </AsyncButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
