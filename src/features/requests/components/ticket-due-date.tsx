import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
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
          required
          disabled={mutation.isPending}
          endYear={new Date().getFullYear() + 10}
          isDateDisabled={(date) => Boolean(previous && date <= previous)}
          disabledDateMessage="Ngày mong muốn mới phải sau ngày mong muốn hiện tại."
        />
        {mutation.isError && <ErrorAlert message={mutation.error.message} />}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => setEditing(false)}
          >
            Hủy đổi ngày
          </Button>
          <AsyncButton
            type="submit"
            loading={mutation.isPending}
            icon={<Save className="size-4" />}
          >
            Lưu ngày mong muốn
          </AsyncButton>
        </div>
      </form>
    );
  return (
    <div className="min-w-0 space-y-2 text-sm font-medium">
      <label htmlFor="ticket-due-date">Ngày mong muốn</label>
      <div className="flex items-center gap-2">
        <Input
          id="ticket-due-date"
          readOnly
          value={formatDataDate(ticket.duedate)}
          className="font-normal"
        />
        {editable && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Đổi ngày mong muốn"
            onClick={() => {
              form.reset({ duedate: ticket.duedate });
              mutation.reset();
              setEditing(true);
            }}
          >
            <Pencil className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
