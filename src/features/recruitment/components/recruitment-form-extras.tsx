import { t, useLocale } from "@/i18n";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { Copy, Paperclip } from "lucide-react";
import { localizedToast as toast } from "@/i18n/toast";
import { Button } from "@/components/ui/button";
import { RequestAttachments } from "@/features/requests/components/request-attachments";
import { TicketFiles } from "@/features/requests/components/ticket-files";
import type { RecruitmentEditorState } from "../types";
import {
  recruitmentFileHref,
  recruitmentText,
} from "../utils/recruitment-format";
export function RecruitmentFormExtras({
  state,
  uploadNames,
  files,
  disabled,
  onFile,
  hideInterviewFile = false,
}: Readonly<{
  state: RecruitmentEditorState;
  uploadNames: string[];
  files: Record<string, File | undefined>;
  disabled: boolean;
  onFile: (name: string, file: File | undefined) => void;
  hideInterviewFile?: boolean;
}>) {
  useLocale();
  return (
    <>
      {state.action === "request" && Boolean(state.row.link_cv) && (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm">
            {" "}
            {t("recruitment", "Mã link CV:")}{" "}
            {recruitmentText(state.row.link_cv)}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void navigator.clipboard
                .writeText(
                  recruitmentFileHref(
                    API_ENDPOINTS.recruitment.publicCv(
                      recruitmentText(state.row.link_cv),
                    ),
                  )!,
                )
                .then(
                  () => toast.success(t("recruitment", "Đã sao chép link CV.")),
                  () =>
                    toast.error(
                      t("recruitment", "Không sao chép được link CV."),
                    ),
                );
            }}
          >
            <Copy className="size-4" />
            {t("recruitment", "Sao chép")}
          </Button>
        </div>
      )}
      {[
        [
          "path_file_recr",
          "name_file_recr",
          t("recruitment", "Tệp tuyển dụng"),
        ],
        ["path_file_cv", "name_file_cv", t("recruitment", "Tệp CV")],
        [
          "path_file_interview",
          "name_file_interview",
          t("recruitment", "Tệp phỏng vấn"),
        ],
      ]
        .filter(
          ([path]) => !hideInterviewFile || path !== "path_file_interview",
        )
        .map(([path, name, label]) => {
          const href = recruitmentFileHref(state.row[path], state.row[name]);
          return href ? (
            <section
              key={path}
              aria-label={label}
              className="min-w-0 space-y-2"
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Paperclip aria-hidden="true" className="size-4" />
                {label}
              </p>
              <TicketFiles
                previewAllFiles
                layout="tiles"
                files={{
                  [recruitmentText(state.row[name]) ||
                  t("recruitment", "Tệp đính kèm")]: href,
                }}
              />
            </section>
          ) : null;
        })}
      {uploadNames.map((name) => (
        <RequestAttachments
          previewAllFiles
          key={name}
          layout="tiles"
          inputId={`recruitment-${name}`}
          label={uploadLabel(name, state.action)}
          hideLabel={
            name === "file_upload" &&
            state.action !== "request" &&
            Boolean(
              recruitmentFileHref(
                state.row.path_file_cv,
                state.row.name_file_cv,
              ),
            )
          }
          files={files[name] ? [files[name]] : []}
          multiple={false}
          description={t("recruitment", "Chọn một tệp bất kỳ, tối đa {0} MB.", [
            name === "file_upload" && state.action !== "request" ? 10 : 50,
          ])}
          disabled={disabled}
          onChange={(selected) => onFile(name, selected[0])}
        />
      ))}
    </>
  );
}

function uploadLabel(name: string, action: string) {
  if (name === "file_note") return t("recruitment", "Tệp ghi chú phỏng vấn");
  return action === "request"
    ? t("recruitment", "Tệp tuyển dụng")
    : t("recruitment", "Tệp CV");
}
