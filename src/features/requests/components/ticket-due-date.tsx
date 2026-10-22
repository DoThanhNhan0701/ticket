import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { ErrorAlert } from "@/components/error-alert";
import { DatePickerField } from "@/components/form/date-picker-field";
import { formatDataDate } from "@/components/data-management";
import { updateTicketDueDate } from "../api/request-detail-api";
import { parseRequestDate } from "../utils/request-detail-data";
import type { RequestDetailData } from "../schemas/request-detail-schema";

export function TicketDueDate({
  ticket,
  onSaved,
}: Readonly<{
  ticket: RequestDetailData;
  onSaved: () => Promise<unknown>;
}>) {
  const [editing, setEditing] = useState(false);
  const form = useForm({ defaultValues: { duedate: ticket.duedate } });
  const previous = parseRequestDate(ticket.duedate);
  const mutation = useMutation({
    mutationFn: ({ duedate }: { duedate: string }) =>
      updateTicketDueDate(ticket.id, duedate, ticket.duedate),
    onSuccess: async () => {
      setEditing(false);
      toast.success("Đã cập nhật ngày mong muốn.");
      try {
        await onSaved();
      } catch {
        toast.error("Đã lưu ngày mong muốn. Vui lòng tải lại yêu cầu.");
      }
    },
  });
  const editable = [1, 2, 3, 6].includes(ticket.ticket_status);
  if (editing && editable)
    return (
      <form
        className="min-w-0 space-y-2"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          if (!mutation.isPending) mutation.mutate(values);
        })}
      >
        <DatePickerField
          control={form.control}
          name="duedate"
          id="ticket-due-date"
          label="Ngày mong muốn"
          className="[&>[data-slot=field-label]]:font-medium [&>[data-slot=field-label]]:leading-5"
          required
          disabled={mutation.isPending}
          endYear={new Date().getFullYear() + 10}
          isDateDisabled={(date) => Boolean(previous && date <= previous)}
          disabledDateMessage="Ngày mong muốn mới phải sau ngày mong muốn hiện tại."
          inputActions={
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 sm:size-10 sm:pointer-coarse:size-11"
                aria-label="Hủy đổi ngày"
                title="Hủy đổi ngày"
                disabled={mutation.isPending}
                onClick={() => setEditing(false)}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
              <AsyncButton
                type="submit"
                size="icon"
                className="size-11 sm:size-10 sm:pointer-coarse:size-11"
                aria-label="Lưu ngày mong muốn"
                title="Lưu ngày mong muốn"
                loading={mutation.isPending}
                icon={<Save className="size-4" aria-hidden="true" />}
              >
                <span className="sr-only">Lưu ngày mong muốn</span>
              </AsyncButton>
            </>
          }
        />
        {mutation.isError && <ErrorAlert message={mutation.error.message} />}
      </form>
    );
  return (
    <div className={`relative min-w-0 space-y-1.5 ${editable ? "pr-14" : ""}`}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
        Ngày mong muốn
      </p>
      <div className="flex min-h-5 min-w-0 items-center text-sm font-medium">
        <span
          aria-label="Ngày mong muốn"
          className="min-w-0 flex-1 wrap-anywhere"
        >
          {formatDataDate(ticket.duedate)}
        </span>
        {editable && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Đổi ngày mong muốn"
            title="Đổi ngày mong muốn"
            className="absolute top-1/2 right-0 size-9 -translate-y-1/2 text-muted-foreground pointer-coarse:size-11"
            onClick={() => {
              form.reset({ duedate: ticket.duedate });
              mutation.reset();
              setEditing(true);
            }}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
