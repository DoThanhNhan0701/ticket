import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { ErrorAlert } from "@/components/error-alert";
import { InputField } from "@/components/form/input-field";
import { SelectField } from "@/components/form/select-field";
import { TextareaField } from "@/components/form/textarea-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { changeRequestStatusRequest } from "../api/change-request-status-api";
import { listRequestStatusesRequest } from "../api/requests-api";
import {
  changeRequestStatusFormSchema,
  type ChangeRequestStatusFormValues,
} from "../schemas/change-request-status-schema";

export function RequestChangeStatus() {
  const { userId } = useAuthContext();
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const form = useForm<ChangeRequestStatusFormValues>({
    resolver: zodResolver(changeRequestStatusFormSchema),
    defaultValues: { ticket_code: "", ticket_status_id: "", lydohuyyeucau: "" },
  });
  const statuses = useQuery({
    queryKey: ["request-statuses", userId],
    queryFn: ({ signal }) => listRequestStatusesRequest(signal),
    retry: false,
  });
  const statusOptions = (statuses.data ?? [])
    .filter(({ id }) => id !== 1)
    .map(({ id, name }) => ({ value: String(id), label: name }));
  const mutation = useMutation({
    mutationKey: ["request-change-status", userId],
    mutationFn: changeRequestStatusRequest,
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  const unavailable =
    statuses.isPending || statuses.isError || statusOptions.length === 0;
  const submit = (values: ChangeRequestStatusFormValues) => {
    if (submitting.current || unavailable) return;
    if (!statusOptions.some(({ value }) => value === values.ticket_status_id)) {
      form.setError("ticket_status_id", {
        message: "Vui lòng chọn trạng thái hợp lệ.",
      });
      return;
    }
    submitting.current = true;
    mutation.mutate({
      ...values,
      ticket_status_id: Number(values.ticket_status_id),
    });
  };

  return (
    <Card className="m-auto w-full max-w-2xl shrink-0 gap-4 p-4 sm:p-6">
      <p className="text-sm text-muted-foreground">
        Nhập mã yêu cầu và chọn trạng thái cần chuyển. Lý do không bắt buộc.
      </p>
      <form
        aria-label="Chuyển trạng thái ticket"
        noValidate
        className="space-y-5"
        onSubmit={form.handleSubmit(submit)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            control={form.control}
            name="ticket_code"
            id="change-status-code"
            label="Mã yêu cầu"
            placeholder="Nhập mã yêu cầu"
            required
            disabled={mutation.isPending}
          />
          <SelectField
            control={form.control}
            name="ticket_status_id"
            id="change-status-value"
            label="Trạng thái"
            placeholder="Chọn trạng thái"
            options={statusOptions}
            searchable
            required
            isLoading={statuses.isPending}
            disabled={mutation.isPending || unavailable}
            noDataText="Không có trạng thái để chọn"
          />
        </div>
        <TextareaField
          control={form.control}
          name="lydohuyyeucau"
          id="change-status-reason"
          label="Lý do"
          placeholder="Nhập lý do chuyển trạng thái"
          disabled={mutation.isPending}
        />
        {statuses.isError && (
          <div className="space-y-2">
            <ErrorAlert
              message={`Không tải được trạng thái: ${statuses.error.message}`}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void statuses.refetch()}
            >
              Thử lại trạng thái
            </Button>
          </div>
        )}
        {statuses.isSuccess && statusOptions.length === 0 && (
          <p role="status" className="text-sm text-muted-foreground">
            Không có trạng thái để chuyển.
          </p>
        )}
        {mutation.isError && <ErrorAlert message={mutation.error.message} />}
        {mutation.isSuccess && (
          <Alert
            role="status"
            className="border-success-border bg-success-soft text-success"
          >
            <CheckCircle2 aria-hidden="true" />
            <AlertDescription className="text-success">
              {mutation.data.message}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <AsyncButton
            type="submit"
            loading={mutation.isPending}
            loadingText="Đang cập nhật..."
            disabled={unavailable}
          >
            Cập nhật
          </AsyncButton>
          <p className="min-w-0 text-xs text-muted-foreground">
            Thay đổi được lưu lịch sử và không gửi email.
          </p>
        </div>
      </form>
    </Card>
  );
}
