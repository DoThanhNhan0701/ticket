import { t, useLocale } from "@/i18n";
import { Controller, type Control } from "react-hook-form";
import { FormFieldShell } from "@/components/form/form-field-shell";
import { Textarea } from "@/components/ui/textarea";
import { RequestAttachments } from "@/features/requests/components/request-attachments";
import { TicketFiles } from "@/features/requests/components/ticket-files";
import type {
  RecruitmentField,
  RecruitmentRow,
  RecruitmentValues,
} from "../types";
import {
  recruitmentFileHref,
  recruitmentText,
} from "../utils/recruitment-format";

export function RecruitmentNoteComposer({
  control,
  field,
  row,
  file,
  disabled,
  onFile,
}: Readonly<{
  control: Control<RecruitmentValues>;
  field: RecruitmentField;
  row: RecruitmentRow;
  file?: File;
  disabled: boolean;
  onFile: (file: File | undefined) => void;
}>) {
  useLocale();
  const id = "recruitment-note";
  const existing = recruitmentFileHref(
    row.path_file_interview,
    row.name_file_interview,
  );
  return (
    <Controller
      control={control}
      name="note"
      render={({ field: input, fieldState }) => (
        <FormFieldShell
          id={id}
          label={field.label}
          required={field.required}
          invalid={fieldState.invalid}
          error={fieldState.error}
        >
          <div
            className={`min-w-0 rounded-2xl border bg-card p-1.5 shadow-xs focus-within:ring-2 focus-within:ring-ring/25 ${fieldState.invalid ? "border-destructive" : "border-input focus-within:border-ring"}`}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("Files"))
                event.preventDefault();
            }}
            onDrop={(event) => {
              if (!event.dataTransfer.files.length) return;
              event.preventDefault();
              event.stopPropagation();
              if (!disabled && !field.readonly)
                onFile(event.dataTransfer.files[0]);
            }}
          >
            <Textarea
              {...input}
              value={String(input.value ?? "")}
              id={id}
              rows={2}
              disabled={disabled || field.readonly}
              placeholder={
                field.placeholder ||
                t("candidates", "Nhập ghi chú phỏng vấn...")
              }
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.error ? `${id}-error` : `${id}-hint`}
              className="min-h-20 max-h-[min(40dvh,15rem)] min-w-0 resize-none overflow-y-auto border-0 bg-transparent py-1.5 field-sizing-content shadow-none ring-0 whitespace-pre-wrap wrap-anywhere focus-visible:ring-0"
            />
            <div className="min-w-0 space-y-3 px-2 pb-1">
              {existing && (
                <TicketFiles
                  previewAllFiles
                  layout="tiles"
                  files={{
                    [recruitmentText(row.name_file_interview) ||
                    t("candidates", "Tệp phỏng vấn")]: existing,
                  }}
                />
              )}
              {!field.readonly && (
                <RequestAttachments
                  previewAllFiles
                  compact
                  inputId="recruitment-file_note"
                  label={t("candidates", "Tệp ghi chú phỏng vấn")}
                  multiple={false}
                  files={file ? [file] : []}
                  disabled={disabled}
                  onChange={(selected) => onFile(selected[0])}
                  actions={
                    <span className="text-xs text-muted-foreground">
                      {t("candidates", "Mọi định dạng · Tối đa 50 MB")}
                    </span>
                  }
                />
              )}
            </div>
          </div>
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {t(
              "candidates",
              "Nội dung và tệp phỏng vấn được lưu cùng ghi chú.",
            )}
          </p>
        </FormFieldShell>
      )}
    />
  );
}
