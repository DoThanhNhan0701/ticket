import { useMutation } from "@tanstack/react-query";
import { downloadFile } from "@/lib/download";
import { downloadRecruitmentNote } from "../api/recruitment-api";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorAlert } from "@/components/error-alert";
import { formatDataDateTime } from "@/components/data-management";
import type { RecruitmentEditorState, RecruitmentRow } from "../types";
import {
  recruitmentRows,
  recruitmentFileHref,
  recruitmentText,
} from "../utils/recruitment-format";
export function RecruitmentFormExtras({
  state,
  uploadNames,
  notes,
  noteError,
  disabled,
  onFile,
}: Readonly<{
  state: RecruitmentEditorState;
  uploadNames: string[];
  notes: RecruitmentRow[];
  noteError: Error | null;
  disabled: boolean;
  onFile: (name: string, file: File | undefined) => void;
}>) {
  const download = useMutation({
    mutationFn: async (file: RecruitmentRow) => ({
      blob: await downloadRecruitmentNote(file.id!),
      name: recruitmentText(file.file_name) || "Ghi_chu",
    }),
    onSuccess: ({ blob, name }) => downloadFile(blob, name),
    retry: false,
  });
  return (
    <>
      {state.action === "request" && Boolean(state.row.link_cv) && (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm">
            Mã link CV: {recruitmentText(state.row.link_cv)}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void navigator.clipboard
                .writeText(
                  recruitmentFileHref(
                    `/cv/${encodeURIComponent(recruitmentText(state.row.link_cv))}`,
                  )!,
                )
                .then(
                  () => toast.success("Đã sao chép link CV."),
                  () => toast.error("Không sao chép được link CV."),
                );
            }}
          >
            <Copy className="size-4" />
            Sao chép
          </Button>
        </div>
      )}
      {[
        ["path_file_recr", "name_file_recr"],
        ["path_file_cv", "name_file_cv"],
        ["path_file_interview", "name_file_interview"],
      ].map(([path, name]) => {
        const href = recruitmentFileHref(state.row[path], state.row[name]);
        return href ? (
          <a
            key={path}
            className="block truncate text-sm text-primary underline"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {recruitmentText(state.row[name]) || "Xem tệp đính kèm"}
          </a>
        ) : null;
      })}
      {uploadNames.map((name) => (
        <div key={name} className="space-y-2">
          <label
            htmlFor={`recruitment-${name}`}
            className="text-sm font-medium"
          >
            {uploadLabel(name, state.action)}
          </label>
          <Input
            id={`recruitment-${name}`}
            type="file"
            disabled={disabled}
            onChange={(event) => onFile(name, event.target.files?.[0])}
          />
        </div>
      ))}
      {download.isError && <ErrorAlert message={download.error.message} />}
      {Boolean(noteError) && <ErrorAlert message={noteError!.message} />}
      {notes.map((note, index) => (
        <div
          key={String(note.id ?? index)}
          className="rounded-lg border p-3 text-sm"
        >
          <p className="text-xs text-muted-foreground">
            {recruitmentText(
              note.fore_user__username ||
                note.user_create_name ||
                note.username,
            )}{" "}
            {formatDataDateTime(
              recruitmentText(note.created || note.note_date),
            )}
          </p>
          <p className="whitespace-pre-wrap">
            {recruitmentText(note.content ?? note.note)}
          </p>
          {recruitmentRows(note.data_file).map((file) => (
            <Button
              key={file.id}
              type="button"
              variant="link"
              className="max-w-full justify-start truncate px-0"
              disabled={download.isPending}
              onClick={() => download.mutate(file)}
            >
              {recruitmentText(file.file_name) || "Tải tệp ghi chú"}
            </Button>
          ))}
          {recruitmentFileHref(note.path_file_note, note.name_file_note) && (
            <a
              href={recruitmentFileHref(
                note.path_file_note,
                note.name_file_note,
              )}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              {recruitmentText(note.name_file_note) || "Tệp ghi chú"}
            </a>
          )}
        </div>
      ))}
    </>
  );
}

function uploadLabel(name: string, action: string) {
  if (name === "file_note") return "Tệp ghi chú phỏng vấn";
  return action === "request" ? "Tệp tuyển dụng" : "Tệp CV";
}
