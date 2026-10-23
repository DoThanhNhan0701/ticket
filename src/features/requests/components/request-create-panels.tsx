import { ErrorToast } from "@/components/error-toast";
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
      {model.draft.restored && !model.created && (
        <p role="status" className="text-sm text-muted-foreground">
          Đã khôi phục bản nháp yêu cầu của bạn.
        </p>
      )}
      {model.draft.loading && (
        <LoadingState message="Đang khôi phục tệp đính kèm..." />
      )}
      {model.draft.storageError && (
        <p role="status" className="text-sm text-warning">
          Trình duyệt không thể lưu đầy đủ bản nháp. Hãy giữ trang này mở cho
          đến khi gửi xong.
        </p>
      )}
      {model.draft.missing.length > 0 && (
        <div role="status" className="space-y-2 text-sm text-warning">
          <p>
            Thông tin đã được khôi phục. Vui lòng chọn lại các tệp chưa khôi
            phục được, hoặc bỏ tệp nếu không còn cần đính kèm.
          </p>
          {model.draft.missing.map((file) => (
            <div
              key={`${file.name}:${file.lastModified}`}
              className="flex items-center gap-2"
            >
              <span>{file.name}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Bỏ tệp cần chọn lại ${file.name}`}
                onClick={() => model.draft.discardMissing(file)}
              >
                Bỏ tệp
              </Button>
            </div>
          ))}
        </div>
      )}
      {model.created && !model.mutation.isError && (
        <p role="status" className="text-sm">
          Yêu cầu #{model.created.ticket_code ?? model.created.id} đã được tạo;
          chỉ tải tiếp các tệp đính kèm còn lại.
        </p>
      )}
      {model.clone.loading && (
        <LoadingState message="Đang tải yêu cầu cần sao chép..." />
      )}
      {model.clone.error && (
        <div className="space-y-2">
          <ErrorAlert message={model.clone.error} />
        </div>
      )}
      {model.lookups.isError && (
        <ErrorToast
          message={`Không tải được danh mục: ${model.lookups.error.message}`}
        />
      )}
      {model.template.isError && model.template.data && (
        <ErrorToast
          message={`Không tải được biểu mẫu: ${model.template.error.message}`}
        />
      )}
      {model.mutation.isError && (
        <ErrorToast message={model.mutation.error.message} />
      )}
      {model.attachmentError && <ErrorAlert message={model.attachmentError} />}
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
      {(groupError?.type === "custom" || groupError?.type === "group-name") && (
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
        <ErrorToast message={model.types.error.message} />
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
    model.selectedType && !model.template.data && model.template.isFetching,
  );
  if (
    model.selectedType &&
    model.template.data &&
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
        <ErrorToast
          message={`Không tải được biểu mẫu: ${model.template.error.message}`}
        />
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
