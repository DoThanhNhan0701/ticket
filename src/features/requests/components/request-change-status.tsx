import { t, translateMessage, useLocale } from "@/i18n";
import { ErrorToast } from "@/components/error-toast";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { localizedToast as toast } from "@/i18n/toast";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { InputField } from "@/components/form/input-field";
import { SelectField } from "@/components/form/select-field";
import { TextareaField } from "@/components/form/textarea-field";
import { AsyncButton } from "@/components/ui/async-button";
import { Card } from "@/components/ui/card";
import { changeRequestStatusRequest } from "../api/change-request-status-api";
import { listRequestStatusesRequest } from "../api/requests-api";
import {
  changeRequestStatusFormSchema,
  type ChangeRequestStatusFormValues,
} from "../schemas/change-request-status-schema";

export function RequestChangeStatus() {
  useLocale();
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
    .map(({ id, name }) => ({ value: String(id), label: t("statuses", name) }));
  const mutation = useMutation({
    mutationKey: ["request-change-status", userId],
    mutationFn: changeRequestStatusRequest,
    retry: false,
    onSuccess: async (data) => {
      toast.success(data.message);
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
        message: t("request-status", "Vui lòng chọn trạng thái hợp lệ."),
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
        {t(
          "request-status",
          "Nhập mã yêu cầu và chọn trạng thái cần chuyển. Lý do không bắt buộc.",
        )}
      </p>
      <form
        aria-label={t("request-status", "Chuyển trạng thái yêu cầu")}
        noValidate
        className="space-y-5"
        onSubmit={form.handleSubmit(submit)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            control={form.control}
            name="ticket_code"
            id="change-status-code"
            label={t("request-status", "Mã yêu cầu")}
            placeholder={t("request-status", "Nhập mã yêu cầu")}
            required
            disabled={mutation.isPending}
          />
          <SelectField
            control={form.control}
            name="ticket_status_id"
            id="change-status-value"
            label={t("request-status", "Trạng thái")}
            placeholder={t("request-status", "Chọn trạng thái")}
            options={statusOptions}
            searchable
            required
            isLoading={statuses.isPending}
            disabled={mutation.isPending || unavailable}
            noDataText={t("request-status", "Không có trạng thái để chọn")}
          />
        </div>
        <TextareaField
          control={form.control}
          name="lydohuyyeucau"
          id="change-status-reason"
          label={t("request-status", "Lý do")}
          placeholder={t("request-status", "Nhập lý do chuyển trạng thái")}
          disabled={mutation.isPending}
        />
        {statuses.isError && (
          <ErrorToast
            message={t("request-status", "Không tải được trạng thái: {0}", [
              translateMessage(statuses.error.message),
            ])}
          />
        )}
        {statuses.isSuccess && statusOptions.length === 0 && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("request-status", "Không có trạng thái để chuyển.")}
          </p>
        )}
        {mutation.isError && <ErrorToast message={mutation.error.message} />}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <AsyncButton
            type="submit"
            loading={mutation.isPending}
            loadingText={t("request-status", "Đang cập nhật...")}
            disabled={unavailable}
          >
            {t("request-status", "Cập nhật")}
          </AsyncButton>
          <p className="min-w-0 text-xs text-muted-foreground">
            {t(
              "request-status",
              "Thay đổi được lưu lịch sử và không gửi email.",
            )}
          </p>
        </div>
      </form>
    </Card>
  );
}
