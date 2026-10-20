import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/loading-state";
import { ErrorAlert } from "@/components/error-alert";
import type { useCreateRequest } from "../hooks/use-create-request";
import { RequestAssignmentFields } from "./request-create-fields";
import { RequestDetailRows } from "./request-detail-rows";
import { RequestFormSection } from "./request-form-section";
type Model = ReturnType<typeof useCreateRequest>;
export function RequestCreateMessages({ model }: Readonly<{ model: Model }>) {
  return (
    <>
      {model.clone.loading && (
        <LoadingState message="Đang tải yêu cầu cần sao chép..." />
      )}
      {model.clone.error && <ErrorAlert message={model.clone.error} />}
      {model.lookups.isError && (
        <div className="space-y-2">
          <ErrorAlert
            message={`Không tải được danh mục: ${model.lookups.error.message}`}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void model.lookups.refetch()}
          >
            Thử lại danh mục
          </Button>
        </div>
      )}
      {model.mutation.isError && (
        <ErrorAlert message={model.mutation.error.message} />
      )}
      {model.created && model.mutation.isError && (
        <p
          role="status"
          className="rounded-lg border border-warning-border bg-warning-soft p-3 text-sm text-warning"
        >
          Yêu cầu #{model.created.ticket_code ?? model.created.id} đã được tạo.
          Tệp đính kèm chưa tải xong; bấm “Tải lại đính kèm” để tiếp tục.
        </p>
      )}
    </>
  );
}
export function RequestAssignmentPanel({
  model,
  disabled,
}: Readonly<{ model: Model; disabled: boolean }>) {
  const manual = model.selectedType?.attachment_file;
  const manualUrl =
    manual && /^(https?:\/\/|\/(?!\/))/.test(manual) ? manual : undefined;
  const groupError = model.form.formState.errors.handling_group;
  return (
    <RequestFormSection
      step={1}
      title="Loại yêu cầu"
      description="Chọn bộ phận phụ trách, loại yêu cầu và người phê duyệt."
    >
      <RequestAssignmentFields
        form={model.form}
        lookups={model.lookups.data}
        disabled={disabled}
        types={model.types.data ?? []}
        typesLoading={model.types.isFetching}
      />
      {groupError?.type === "custom" && (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          disabled={disabled || model.lookups.isFetching}
          onClick={() => void model.lookups.refetch()}
        >
          Tải lại danh mục
        </Button>
      )}
      {model.types.isError && (
        <div className="space-y-2">
          <ErrorAlert message={model.types.error.message} />
          <Button
            type="button"
            variant="outline"
            onClick={() => void model.types.refetch()}
          >
            Thử lại loại yêu cầu
          </Button>
        </div>
      )}
      {model.types.isSuccess && model.types.data.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Bộ phận này chưa có loại yêu cầu đang kích hoạt.
        </p>
      )}
      {manualUrl && (
        <a
          href={manualUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 w-fit max-w-full items-center gap-2 rounded-lg text-sm text-brand-700 underline-offset-4 hover:underline dark:text-brand-200 sm:min-h-0 sm:pointer-coarse:min-h-11"
        >
          <FileText className="size-4 shrink-0" aria-hidden="true" />
          Tài liệu hướng dẫn
        </a>
      )}
    </RequestFormSection>
  );
}
export function RequestTemplateSection({
  model,
  disabled,
  onBusyChange,
}: Readonly<{
  model: Model;
  disabled: boolean;
  onBusyChange: (value: boolean) => void;
}>) {
  const templateLoading = Boolean(
    model.selectedType && model.template.isFetching,
  );
  if (
    model.selectedType &&
    model.template.isSuccess &&
    !templateLoading &&
    model.groups.length > 0
  ) {
    return (
      <RequestDetailRows
        key={model.selectedType.id}
        form={model.form}
        groups={model.groups}
        type={model.selectedType}
        disabled={disabled}
        onBusyChange={onBusyChange}
      />
    );
  }
  return (
    <RequestFormSection step={3} title="Chi tiết yêu cầu">
      {!model.selectedType && (
        <p className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          <FileText className="size-5 shrink-0" aria-hidden="true" />
          Chọn loại yêu cầu ở trên để hiển thị biểu mẫu chi tiết.
        </p>
      )}
      {templateLoading && (
        <LoadingState message="Đang tải biểu mẫu chi tiết..." />
      )}
      {model.selectedType && model.template.isError && (
        <div className="space-y-2">
          <ErrorAlert
            message={`Không tải được biểu mẫu: ${model.template.error.message}`}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void model.template.refetch()}
          >
            Thử lại biểu mẫu
          </Button>
        </div>
      )}
      {model.selectedType &&
        model.template.isSuccess &&
        !templateLoading &&
        model.groups.length === 0 && (
          <p
            role="status"
            className="rounded-lg bg-muted/20 p-4 text-sm text-muted-foreground"
          >
            {model.template.data?.forms.length
              ? "Các phần chi tiết sẽ được cập nhật sau khi tạo yêu cầu."
              : "Loại yêu cầu này không có biểu mẫu chi tiết."}
          </p>
        )}
    </RequestFormSection>
  );
}
