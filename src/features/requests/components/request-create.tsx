import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { LoadingState } from "@/components/loading-state";
import { useCreateRequest } from "../hooks/use-create-request";
import { useRequestCreateSteps } from "../hooks/use-request-create-steps";
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
  const model = useCreateRequest(),
    navigate = useNavigate();
  const steps = useRequestCreateSteps(model);
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
    return <LoadingState message="Đang tải yêu cầu cần sao chép..." />;
  return (
    <form
      aria-label="Tạo yêu cầu mới"
      noValidate
      className="relative w-full min-w-0 space-y-4 pb-3"
      aria-busy={busy || model.lookups.isPending}
      onSubmit={(event) => {
        if (busy || waitingForData || model.created) {
          event.preventDefault();
          return;
        }
        void model.form.handleSubmit(model.submit)(event);
      }}
    >
      <RequestCreateMessages model={model} />
      <div className="relative min-w-0 space-y-4">
        <RequestAssignmentPanel model={model} disabled={disabled} />
        {steps.general && (
          <RequestFormSection
            step={2}
            title="Thông tin yêu cầu"
            description="Nhập nội dung cần hỗ trợ và thông tin đơn vị sử dụng."
          >
            <RequestGeneralFields
              form={model.form}
              lookups={model.lookups.data}
              disabled={disabled}
            />
          </RequestFormSection>
        )}
        {model.lookups.isPending && (
          <LoadingState
            message="Đang tải danh mục..."
            className="absolute inset-0 z-10 justify-start rounded-xl bg-card/85 pt-16"
          />
        )}
      </div>
      {steps.details && (
        <RequestTemplateSection
          model={model}
          disabled={disabled}
          onBusyChange={setExcelBusy}
        />
      )}
      {(steps.additional || model.created) && (
        <RequestFormSection
          step={4}
          title="Thông tin bổ sung"
          description="Ghi chú và tài liệu đính kèm nếu cần."
        >
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <RequestNotesField form={model.form} disabled={disabled} />
            <RequestAttachments
              files={model.files}
              onChange={model.setFiles}
              disabled={busy || model.draft.loading}
            />
          </div>
        </RequestFormSection>
      )}
      <div className="sticky bottom-0 z-20 flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur-sm">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          aria-label="Quay lại danh sách"
          title="Quay lại danh sách"
          className="size-11 p-0 sm:w-auto sm:px-4"
          onClick={() => navigate("/requests")}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Quay lại</span>
        </Button>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
          <Button
            type="button"
            variant="ghost"
            disabled={requestResetDisabled(model, busy)}
            aria-label="Làm lại"
            title="Làm lại"
            className="size-11 p-0 sm:w-auto sm:px-4"
            onClick={model.reset}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Làm lại</span>
          </Button>
          <AsyncButton
            type={model.created ? "button" : "submit"}
            loading={model.mutation.isPending}
            loadingText="Đang gửi..."
            disabled={submitDisabled}
            onClick={model.created ? model.retryAttachments : undefined}
            className="min-w-0 flex-1 sm:flex-none"
            icon={<Send className="size-4" aria-hidden="true" />}
          >
            {model.created ? "Tải lại đính kèm" : "Tạo yêu cầu"}
          </AsyncButton>
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
    (!model.created && waitingForData)
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
