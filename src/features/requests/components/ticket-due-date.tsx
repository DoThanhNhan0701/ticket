import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
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
    <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
      <label htmlFor="ticket-due-date">Ngày mong muốn</label>
      <div className="relative">
        <Input
          id="ticket-due-date"
          readOnly
          value={formatDataDate(ticket.duedate)}
          title={formatDataDate(ticket.duedate)}
          className={cn("font-normal", editable && "pl-11")}
        />
        {editable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Đổi ngày mong muốn"
            title="Đổi ngày mong muốn"
            className="absolute inset-y-0 left-0 h-auto w-11 rounded-r-none text-muted-foreground"
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
