import { useEffect, useRef } from "react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Copy, Download, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { ErrorAlert } from "@/components/error-alert";
import { TruncatedText } from "@/components/truncated-text";
import { downloadFile } from "@/lib/download";
import type { TemplateGroup } from "@/features/settings/schemas/template-schema";
import type { RequestType } from "../types";
import type { CreateRequestValues } from "../schemas/create-request-schema";
import {
  exportRequestTemplate,
  importRequestTemplate,
} from "../api/create-request-api";
import {
  detailFields,
  importedDetailRows,
  emptyDetailRow,
  fieldOptions,
} from "../utils/request-detail-data";
import { RequestDetailField } from "./request-detail-field";
import { RequestFormSection } from "./request-form-section";

function detailColumnWidth(field: ReturnType<typeof detailFields>[number]) {
  const minimum =
    field.type === "range-date-text" && !fieldOptions(field).length ? 440 : 200;
  const configured = Number(field.widthcol);
  return Number.isFinite(configured) ? Math.max(minimum, configured) : minimum;
}

export function RequestDetailRows({
  form,
  groups,
  type,
  disabled,
  onBusyChange,
}: Readonly<{
  form: UseFormReturn<CreateRequestValues>;
  groups: TemplateGroup[];
  type: RequestType;
  disabled: boolean;
  onBusyChange: (value: boolean) => void;
}>) {
  const rows = useFieldArray({ control: form.control, name: "rows" });
  const input = useRef<HTMLInputElement>(null),
    live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      onBusyChange(false);
    };
  }, [onBusyChange]);
  const download = useMutation({
    mutationFn: () => exportRequestTemplate(type.id),
    onSuccess: (blob) => downloadFile(blob, `${type.slug_name}_mau.xlsx`),
    retry: false,
  });
  const upload = useMutation({
    mutationFn: (file: File) => importRequestTemplate(type.id, file),
    onMutate: () => onBusyChange(true),
    onSuccess: (data) => {
      if (!live.current) return;
      rows.replace(importedDetailRows(groups, data));
      form.clearErrors("rows");
      toast.success("Đã nhập Excel. Vui lòng kiểm tra các dòng chi tiết.");
    },
    onSettled: () => {
      if (live.current) onBusyChange(false);
    },
    retry: false,
  });
  const fields = detailFields(groups),
    busy = disabled || upload.isPending;
  const widths = fields.map(detailColumnWidth);
  const minimumWidth =
    widths.reduce((total, width) => total + width, 26) +
    Math.max(0, fields.length - 1) * 16;
  const columns = widths.map((width) => `minmax(${width}px, 1fr)`).join(" ");
  return (
    <section aria-label="Chi tiết yêu cầu" className="min-w-0">
      <RequestFormSection
        step={3}
        title={
          <>
            <span className="shrink-0">Chi tiết yêu cầu</span>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <TruncatedText
              text={groups.map((group) => group.title).join(" · ")}
              className="text-muted-foreground"
            />
          </>
        }
        description={`${rows.fields.length} dòng · Cuộn ngang khi cần để xem thêm trường.`}
        actions={
          <>
            <AsyncButton
              type="button"
              variant="outline"
              loading={download.isPending}
              disabled={busy}
              onClick={() => download.mutate()}
            >
              <Download className="size-4" aria-hidden="true" />
              Tải mẫu
            </AsyncButton>
            <AsyncButton
              type="button"
              variant="outline"
              loading={upload.isPending}
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Upload className="size-4" aria-hidden="true" />
              Nhập Excel
            </AsyncButton>
            <input
              ref={input}
              type="file"
              tabIndex={-1}
              accept=".xlsx"
              aria-label="Nhập chi tiết từ Excel"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.target.value = "";
              }}
            />
          </>
        }
      >
        {download.isError && <ErrorAlert message={download.error.message} />}
        {upload.isError && <ErrorAlert message={upload.error.message} />}
        {form.formState.errors.rows?.root?.message && (
          <ErrorAlert message={form.formState.errors.rows.root.message} />
        )}
        <div
          role="region"
          aria-label="Các dòng chi tiết yêu cầu"
          className="min-w-0 max-w-full overflow-x-auto rounded-lg pb-2"
        >
          <div
            className="min-w-full space-y-4"
            style={{ minWidth: minimumWidth }}
          >
            {rows.fields.map((row, index) => (
              <fieldset
                key={row.id}
                aria-label={`Dòng ${index + 1}`}
                className="min-w-0 rounded-lg border border-border px-3 pb-3 pt-3"
              >
                <legend className="sticky left-0 z-10 rounded-lg bg-card px-2 text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap">Dòng {index + 1}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-11 sm:size-9"
                        title="Sao chép dòng"
                        aria-label={`Sao chép dòng ${index + 1}`}
                        disabled={busy}
                        onClick={() =>
                          rows.append({
                            values: {
                              ...form.getValues(`rows.${index}.values`),
                            },
                          })
                        }
                      >
                        <Copy className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-11 text-destructive sm:size-9"
                        title="Xóa dòng"
                        aria-label={`Xóa dòng ${index + 1}`}
                        disabled={busy || rows.fields.length === 1}
                        onClick={() => rows.remove(index)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </legend>
                <div
                  className="grid items-start gap-4"
                  style={{ gridTemplateColumns: columns }}
                >
                  {groups.length > 1 &&
                    groups.map((group, groupIndex) => (
                      <h3
                        key={groupIndex}
                        title={group.title}
                        className="min-w-0 truncate border-b border-border pb-2 text-sm font-medium"
                        style={{
                          gridColumn: `span ${group.children.length}`,
                          gridRow: 1,
                        }}
                      >
                        {group.title}
                      </h3>
                    ))}
                  {fields.map((field, column) => (
                    <div
                      key={field.fieldKey}
                      title={field.title}
                      className="min-w-0"
                      style={{
                        gridColumn: column + 1,
                        gridRow: groups.length > 1 ? 2 : 1,
                      }}
                    >
                      <RequestDetailField
                        form={form}
                        field={field}
                        fields={fields}
                        row={index}
                        disabled={busy}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          disabled={busy}
          onClick={() => rows.append(emptyDetailRow(groups))}
        >
          <Plus className="size-4" aria-hidden="true" />
          Thêm dòng
        </Button>
      </RequestFormSection>
    </section>
  );
}
