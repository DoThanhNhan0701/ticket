import { t, useLocale } from "@/i18n";
import "./request-create.css";
import { RequestRowsValidation } from "./request-rows-validation";
import { APP_ROUTES } from "@/constants/routes";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { LoadingState } from "@/components/loading-state";
import { useCreateRequest } from "../hooks/use-create-request";
import {
  RequestGeneralFields,
  RequestNotesField,
} from "./request-create-fields";
import { RequestAttachments } from "./request-attachments";
import { RequestFormSection } from "./request-form-section";
import {
  RequestAssignmentPanel,
  RequestCreateMessages,
  RequestTemplateSection,
} from "./request-create-panels";

export function RequestCreate() {
  useLocale();
  const model = useCreateRequest(),
    navigate = useNavigate();
  const [excelBusy, setExcelBusy] = useState(false);
  const cloneLoading = useCloneFormLoading(model);
  const busy = model.mutation.isPending || excelBusy;
  const disabled =
    busy ||
    model.draft.loading ||
    model.lookups.isPending ||
    model.clone.loading ||
    Boolean(model.created);
  const waitingForData =
    !model.lookups.isSuccess ||
    model.types.isFetching ||
    model.template.isFetching;
  const submitDisabled = requestSubmitDisabled(
    model,
    excelBusy,
    waitingForData,
  );
  if (cloneLoading)
    return (
      <LoadingState
        message={t("request-create", "Đang tải yêu cầu cần sao chép...")}
      />
    );
  return (
    <form
      aria-label={t("request-create", "Tạo yêu cầu mới")}
      noValidate
      className="request-create-form relative w-full min-w-0 space-y-1.5 pb-1.5"
      aria-busy={busy || model.lookups.isPending}
      onSubmit={(event) => {
        if (busy || waitingForData || model.created) {
          event.preventDefault();
          return;
        }
        void model.form.handleSubmit(model.submit)(event);
      }}
    >
      <RequestRowsValidation form={model.form} groups={model.groups} />
      <RequestCreateMessages model={model} />
      <div className="relative min-w-0 space-y-1.5">
        <RequestAssignmentPanel model={model} disabled={disabled} />
        <RequestFormSection
          step={2}
          title={t("request-create", "Thông tin yêu cầu")}
          description={t(
            "request-create",
            "Nhập nội dung cần hỗ trợ và thông tin đơn vị sử dụng.",
          )}
        >
          <RequestGeneralFields
            form={model.form}
            lookups={model.lookups.data}
            disabled={disabled}
          />
        </RequestFormSection>
        {model.lookups.isPending && (
          <LoadingState
            message={t("request-create", "Đang tải danh mục...")}
            className="absolute inset-0 z-10 justify-start rounded-xl bg-card/85 pt-16"
          />
        )}
      </div>
      <RequestTemplateSection
        model={model}
        disabled={disabled}
        onBusyChange={setExcelBusy}
      />
      <RequestFormSection
        step={4}
        title={t("request-create", "Thông tin bổ sung")}
        description={t(
          "request-create",
          "Ghi chú và tài liệu đính kèm nếu cần.",
        )}
      >
        <div className="grid min-w-0 grid-cols-1 items-start gap-2 lg:grid-cols-2">
          <RequestNotesField form={model.form} disabled={disabled} />
          <RequestAttachments
            layout="tiles"
            previewAllFiles
            files={model.files}
            onChange={model.setFiles}
            disabled={busy || model.draft.loading}
          />
        </div>
      </RequestFormSection>
      <div className="sticky bottom-0 z-20 pt-1.5">
        <div className="flex min-w-0 items-center justify-between gap-1.5 rounded-lg border border-border bg-card/95 px-2 py-1.5 shadow-sm backdrop-blur-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            aria-label={t("request-create", "Quay lại danh sách")}
            title={t("request-create", "Quay lại danh sách")}
            className="size-7 p-0 sm:w-auto sm:px-2.5"
            onClick={() => navigate(APP_ROUTES.requests.list)}
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">
              {t("request-create", "Quay lại")}
            </span>
          </Button>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:flex-none">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={requestResetDisabled(model, busy)}
              aria-label={t("request-create", "Làm lại")}
              title={t("request-create", "Làm lại")}
              className="size-7 p-0 sm:w-auto sm:px-2.5"
              onClick={model.reset}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">
                {t("request-create", "Làm lại")}
              </span>
            </Button>
            <AsyncButton
              type={model.created ? "button" : "submit"}
              size="sm"
              loading={model.mutation.isPending}
              loadingText={t("request-create", "Đang gửi...")}
              disabled={submitDisabled}
              onClick={model.created ? model.retryAttachments : undefined}
              className="min-w-0 flex-1 px-2.5 sm:flex-none"
              icon={<Send className="size-3.5" aria-hidden="true" />}
            >
              {model.created
                ? t("request-create", "Tải lại đính kèm")
                : t("request-create", "Tạo yêu cầu")}
            </AsyncButton>
          </div>
        </div>
      </div>
    </form>
  );
}

function requestSubmitDisabled(
  model: ReturnType<typeof useCreateRequest>,
  excelBusy: boolean,
  waitingForData: boolean,
) {
  return (
    excelBusy ||
    model.draft.loading ||
    model.draft.missing.length > 0 ||
    (!model.created && (waitingForData || Boolean(model.groupNameError)))
  );
}

function requestResetDisabled(
  model: ReturnType<typeof useCreateRequest>,
  busy: boolean,
) {
  return (
    busy || model.draft.loading || model.clone.loading || Boolean(model.created)
  );
}

function useCloneFormLoading(model: ReturnType<typeof useCreateRequest>) {
  const [cloneFormRevealed, setCloneFormRevealed] = useState(false);
  useEffect(() => {
    if (
      model.clone.id &&
      model.clone.ready &&
      !model.draft.loading &&
      model.lookups.isSuccess &&
      !model.types.isFetching &&
      !model.template.isFetching
    )
      setCloneFormRevealed(true);
  }, [
    model.clone.id,
    model.clone.ready,
    model.draft.loading,
    model.lookups.isSuccess,
    model.types.isFetching,
    model.template.isFetching,
  ]);
  return Boolean(
    model.clone.id &&
    !cloneFormRevealed &&
    !model.clone.error &&
    !model.lookups.isError &&
    !model.types.isError &&
    !model.template.isError,
  );
}
