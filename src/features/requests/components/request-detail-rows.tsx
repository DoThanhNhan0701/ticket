import { t, useLocale } from "@/i18n";
import { ErrorToast } from "@/components/error-toast";
import { memo, useEffect, useMemo, useRef } from "react";
import {
  useFieldArray,
  useFormState,
  type UseFormReturn,
} from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Copy, Download, Plus, Trash2, Upload } from "lucide-react";
import { localizedToast as toast } from "@/i18n/toast";
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
import { RequestDetailProgress } from "./request-detail-progress";
import { RequestFormSection } from "./request-form-section";

function detailColumnWidth(field: ReturnType<typeof detailFields>[number]) {
  const minimum =
    field.type === "range-date-text" && !fieldOptions(field).length ? 440 : 200;
  const configured = Number(field.widthcol);
  return Number.isFinite(configured) ? Math.max(minimum, configured) : minimum;
}

export const RequestDetailRows = memo(function RequestDetailRows({
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
  useLocale();
  const rows = useFieldArray({ control: form.control, name: "rows" });
  const { errors } = useFormState({ control: form.control, name: "rows" });
  const scrollContainer = useRef<HTMLDivElement>(null);
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
      toast.success(
        t(
          "request-create",
          "Đã nhập Excel. Vui lòng kiểm tra các dòng chi tiết.",
        ),
      );
    },
    onSettled: () => {
      if (live.current) onBusyChange(false);
    },
    retry: false,
  });
  const fields = useMemo(() => detailFields(groups), [groups]),
    busy = disabled || upload.isPending;
  const widths = fields.map(detailColumnWidth);
  const minimumWidth =
    widths.reduce((total, width) => total + width, 26) +
    Math.max(0, fields.length - 1) * 16;
  const columns = widths.map((width) => `minmax(${width}px, 1fr)`).join(" ");
  const groupTitle = groups.map((group) => group.title).join(" · ");
  return (
    <section
      aria-label={t("request-create", "Chi tiết yêu cầu")}
      className="min-w-0"
    >
      <RequestFormSection
        step={3}
        title={
          <span
            className="block min-w-0 truncate"
            title={t("request-create", "Chi tiết yêu cầu · {0}", [groupTitle])}
          >
            {" "}
            {t("request-create", "Chi tiết yêu cầu")}{" "}
            <span className="hidden sm:inline">{` · ${groupTitle}`}</span>
          </span>
        }
        description={t(
          "request-create",
          "{0} dòng · Cuộn ngang khi cần để xem thêm trường.",
          [rows.fields.length],
        )}
        actions={
          <>
            <AsyncButton
              mobileIconOnly
              title={t("request-create", "Tải mẫu")}
              icon={<Download className="size-4" aria-hidden="true" />}
              type="button"
              variant="outline"
              loading={download.isPending}
              disabled={busy}
              onClick={() => download.mutate()}
            >
              {t("request-create", "Tải mẫu")}
            </AsyncButton>
            <AsyncButton
              mobileIconOnly
              title={t("request-create", "Nhập Excel")}
              icon={<Upload className="size-4" aria-hidden="true" />}
              type="button"
              variant="outline"
              loading={upload.isPending}
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {t("request-create", "Nhập Excel")}
            </AsyncButton>
            <input
              ref={input}
              type="file"
              tabIndex={-1}
              accept=".xlsx"
              aria-label={t("request-create", "Nhập chi tiết từ Excel")}
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
        {download.isError && <ErrorToast message={download.error.message} />}
        {upload.isError && <ErrorToast message={upload.error.message} />}
        {errors.rows?.root?.message && (
          <ErrorAlert message={errors.rows.root.message} />
        )}
        <RequestDetailProgress
          form={form}
          fields={fields}
          disabled={busy}
          scrollContainer={scrollContainer}
        />
        {/* Keep absolutely positioned field labels inside the scroll container. */}
        <div
          ref={scrollContainer}
          role="region"
          aria-label={t("request-create", "Các dòng chi tiết yêu cầu")}
          className="relative min-w-0 max-w-full overflow-x-auto rounded-lg pb-2"
        >
          <div
            className="min-w-full space-y-1.5 pr-3"
            style={{ minWidth: `calc(${minimumWidth}px + 0.75rem)` }}
          >
            <div
              role="group"
              aria-label={t("request-create", "Tiêu đề các cột chi tiết")}
              className="grid items-start gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
              style={{ gridTemplateColumns: columns }}
            >
              {groups.length > 1 &&
                groups.map((group, index) => (
                  <h3
                    key={index}
                    title={group.title}
                    className="min-w-0 truncate border-b border-border pb-1 text-sm font-medium"
                    style={{ gridColumn: `span ${group.children.length}` }}
                  >
                    {group.title}
                  </h3>
                ))}
              {fields.map((field, column) => (
                <div
                  key={field.fieldKey}
                  className="min-w-0 text-sm font-semibold"
                  style={{
                    gridColumn: column + 1,
                    gridRow: groups.length > 1 ? 2 : 1,
                  }}
                >
                  <div className="flex min-w-0 items-center gap-1">
                    <TruncatedText text={field.title} />
                    {field.required && (
                      <span
                        className="shrink-0 text-destructive"
                        aria-hidden="true"
                      >
                        *
                      </span>
                    )}
                    {field.type === "range-date-text" &&
                      !fieldOptions(field).length && (
                        <span className="shrink-0 whitespace-nowrap text-xs font-normal text-muted-foreground">
                          {t("request-create", "(Từ ngày – Đến ngày)")}
                        </span>
                      )}
                  </div>
                </div>
              ))}
            </div>
            {rows.fields.map((row, index) => (
              <fieldset
                key={row.id}
                aria-label={t("request-create", "Dòng {0}", [index + 1])}
                className="min-w-0 rounded-lg border border-border px-3 pt-1 pb-2"
              >
                <legend className="sticky left-0 z-10 rounded-lg bg-card px-2 text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap">
                      {t("request-create", "Dòng")} {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-11 sm:size-9"
                        title={t("request-create", "Sao chép dòng")}
                        aria-label={t("request-create", "Sao chép dòng {0}", [
                          index + 1,
                        ])}
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
                        title={t("request-create", "Xóa dòng")}
                        aria-label={t("request-create", "Xóa dòng {0}", [
                          index + 1,
                        ])}
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
                  {fields.map((field, column) => (
                    <div
                      key={field.fieldKey}
                      title={field.title}
                      className="min-w-0"
                      style={{
                        gridColumn: column + 1,
                      }}
                    >
                      <RequestDetailField
                        hideLabel
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
          {t("request-create", "Thêm dòng")}
        </Button>
      </RequestFormSection>
    </section>
  );
});
