import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { History, MessageSquareText, Paperclip, UserRound } from "lucide-react";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingState } from "@/components/loading-state";
import { FilePreviewDialog } from "@/components/file-preview-dialog";
import { FileAttachmentTile } from "@/features/requests/components/file-attachment-tile";
import { TicketFiles } from "@/features/requests/components/ticket-files";
import { formatDataDateTime } from "@/components/data-management";
import {
  downloadRecruitmentNote,
  recruitmentArray,
} from "../api/recruitment-api";
import type { RecruitmentRow } from "../types";
import {
  recruitmentRows,
  recruitmentFileHref,
  recruitmentText,
} from "../utils/recruitment-format";

function noteImage(name: string) {
  return /\.(?:png|jpe?g|gif|webp|avif|bmp)$/i.test(name);
}

export function RecruitmentNoteHistory({
  candidateId,
}: Readonly<{ candidateId: number }>) {
  const { userId } = useAuthContext();
  const query = useQuery({
    queryKey: ["recruitment-notes", userId, candidateId],
    queryFn: ({ signal }) =>
      recruitmentArray(`/note-cv/${candidateId}`, undefined, signal),
    retry: false,
  });
  const notes = query.data ?? [];
  const [preview, setPreview] = useState<File>();
  const download = useMutation({
    mutationFn: async (file: RecruitmentRow) => ({
      blob: await downloadRecruitmentNote(file.id!),
      name: recruitmentText(file.file_name) || "Ghi_chu",
    }),
    onSuccess: ({ blob, name }) =>
      setPreview(new File([blob], name, { type: blob.type })),
    retry: false,
  });
  return (
    <div className="space-y-3">
      {query.isPending && (
        <LoadingState message="Đang tải lịch sử ghi chú..." />
      )}
      {query.isError && (
        <div className="space-y-2">
          <ErrorAlert message={query.error.message} />
          <Button
            type="button"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            Thử lại lịch sử
          </Button>
        </div>
      )}
      {query.isSuccess && notes.length === 0 && (
        <p
          role="status"
          className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground"
        >
          Chưa có lịch sử ghi chú phỏng vấn.
        </p>
      )}
      {download.isError && <ErrorAlert message={download.error.message} />}
      {download.isPending && (
        <p role="status" className="text-xs text-muted-foreground">
          Đang mở tệp...
        </p>
      )}
      {preview && (
        <FilePreviewDialog
          file={preview}
          onClose={() => setPreview(undefined)}
        />
      )}
      {notes.length > 0 && (
        <section
          aria-label="Lịch sử ghi chú phỏng vấn"
          className="min-w-0 space-y-3 border-t pt-4"
        >
          <div className="flex items-center gap-2">
            <History aria-hidden="true" className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Lịch sử ghi chú phỏng vấn</h3>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {notes.length}
            </span>
          </div>
          <div className="space-y-3">
            {notes.map((note, index) => (
              <article
                key={String(note.id ?? index)}
                className="min-w-0 overflow-hidden rounded-xl border bg-card text-sm"
              >
                <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2.5 sm:px-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    >
                      <UserRound className="size-3.5" />
                    </span>
                    <p className="min-w-0 break-all font-medium">
                      {recruitmentText(
                        note.fore_user__username ||
                          note.user_create_name ||
                          note.username,
                      ) || "Chưa rõ người ghi"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDataDateTime(
                      recruitmentText(note.created || note.note_date),
                    )}
                  </p>
                </header>
                <div className="min-w-0 space-y-3 p-3 sm:p-4">
                  {recruitmentText(note.content ?? note.note).trim() ? (
                    <div className="flex min-w-0 gap-2">
                      <MessageSquareText
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      />
                      <p className="min-w-0 whitespace-pre-wrap wrap-anywhere leading-relaxed">
                        {recruitmentText(note.content ?? note.note)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      Không có nội dung ghi chú.
                    </p>
                  )}
                  {(recruitmentRows(note.data_file).length > 0 ||
                    recruitmentFileHref(
                      note.path_file_note,
                      note.name_file_note,
                    )) && (
                    <div className="min-w-0 space-y-2">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Paperclip aria-hidden="true" className="size-3.5" />
                        Tệp đính kèm
                      </p>
                      <div className="flex min-w-0 flex-wrap gap-2">
                        <ul className="flex min-w-0 flex-wrap gap-2">
                          {recruitmentRows(note.data_file).map((file) => (
                            <FileAttachmentTile
                              key={file.id}
                              name={
                                recruitmentText(file.file_name) || "Tệp ghi chú"
                              }
                              image={noteImage(recruitmentText(file.file_name))}
                              previewLabel={`${noteImage(recruitmentText(file.file_name)) ? "Xem ảnh" : "Mở tệp"} ${recruitmentText(file.file_name) || "Tệp ghi chú"}`}
                              disabled={download.isPending}
                              onPreview={() => download.mutate(file)}
                            />
                          ))}
                        </ul>
                        {recruitmentFileHref(
                          note.path_file_note,
                          note.name_file_note,
                        ) && (
                          <TicketFiles
                            previewAllFiles
                            layout="tiles"
                            files={{
                              [recruitmentText(note.name_file_note) ||
                              "Tệp ghi chú"]: recruitmentFileHref(
                                note.path_file_note,
                                note.name_file_note,
                              )!,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
