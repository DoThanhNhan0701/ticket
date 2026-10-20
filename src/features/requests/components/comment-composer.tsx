import { useId, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Save, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { ErrorAlert } from "@/components/error-alert";
import {
  MAX_COMMENT_FILE_SIZE,
  type DiscussionDraft,
} from "../api/ticket-discussion-api";
import { RequestAttachments } from "./request-attachments";
import { TicketFiles } from "./ticket-files";
import { CommentMentions } from "./comment-mentions";

interface CommentComposerProps {
  label?: string;
  initialContent?: string;
  existingFiles?: Record<string, string>;
  editing?: boolean;
  onSend: (draft: DiscussionDraft) => Promise<void>;
  onSaved: () => Promise<unknown>;
  onCancel?: () => void;
  onDone?: () => void;
  onBusyChange?: (busy: boolean) => void;
}
export function CommentComposer({
  label = "Phản hồi",
  initialContent = "",
  existingFiles = {},
  editing = false,
  onSend,
  onSaved,
  onCancel,
  onDone,
  onBusyChange,
}: Readonly<CommentComposerProps>) {
  const id = useId();
  const submitting = useRef(false);
  const [content, setContent] = useState(initialContent);
  const [files, setFiles] = useState<File[]>([]);
  const [removedFiles, setRemovedFiles] = useState<string[]>([]);
  const [empty, setEmpty] = useState(false);
  const [fileError, setFileError] = useState("");
  const restoreFile = (name: string) =>
    setRemovedFiles(removedFiles.filter((file) => file !== name));
  const mutation = useMutation({
    mutationFn: onSend,
    retry: false,
    onMutate: () => onBusyChange?.(true),
    onSuccess: async () => {
      setContent("");
      setFiles([]);
      setRemovedFiles([]);
      setEmpty(false);
      setFileError("");
      toast.success(editing ? "Đã cập nhật phản hồi." : "Đã gửi phản hồi.");
      try {
        await onSaved();
      } catch {
        toast.error("Đã lưu phản hồi. Vui lòng tải lại để xem dữ liệu mới.");
      }
      onDone?.();
    },
    onSettled: () => {
      submitting.current = false;
      onBusyChange?.(false);
    },
  });
  return (
    <form
      aria-label={editing ? "Chỉnh sửa bình luận" : `${label} mới`}
      className="min-w-0 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (submitting.current) return;
        setEmpty(!content.trim());
        if (!content.trim()) return;
        submitting.current = true;
        mutation.mutate({ content, files, removedFiles });
      }}
    >
      <CommentMentions
        id={id}
        label={label}
        value={content}
        onChange={setContent}
        disabled={mutation.isPending}
        invalid={empty}
      >
        <div className="min-w-0 space-y-3 px-2 pb-1">
          {Object.keys(existingFiles).length > 0 && (
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium">Tệp đã đính kèm</p>
              <TicketFiles
                files={existingFiles}
                layout="tiles"
                removedFiles={removedFiles}
                disabled={mutation.isPending}
                onRemove={(name) =>
                  setRemovedFiles((current) => [...current, name])
                }
                onRestore={restoreFile}
              />
            </div>
          )}
          <RequestAttachments
            compact
            actions={
              <div className="flex shrink-0 items-center gap-2">
                {onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 rounded-xl"
                    aria-label="Hủy"
                    title="Hủy"
                    disabled={mutation.isPending}
                    onClick={onCancel}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                )}
                <AsyncButton
                  type="submit"
                  loading={mutation.isPending}
                  loadingText={
                    <span className="sr-only">
                      {editing ? "Đang lưu..." : "Đang gửi..."}
                    </span>
                  }
                  size="icon"
                  variant="default"
                  aria-label={editing ? "Lưu thay đổi" : "Gửi phản hồi"}
                  title={editing ? "Lưu thay đổi" : "Gửi phản hồi"}
                  icon={
                    editing ? (
                      <Save className="size-4" />
                    ) : (
                      <Send className="size-4" />
                    )
                  }
                  className="size-9 shrink-0 rounded-xl"
                >
                  <span className="sr-only">
                    {editing ? "Lưu thay đổi" : "Gửi phản hồi"}
                  </span>
                </AsyncButton>
              </div>
            }
            files={files}
            disabled={mutation.isPending}
            onChange={(selected) => {
              const invalid = selected.filter(
                (file) => file.size > MAX_COMMENT_FILE_SIZE,
              );
              setFileError(
                invalid.length
                  ? `Tệp “${invalid[0].name}” vượt quá 50 MB.`
                  : "",
              );
              setFiles(
                selected.filter((file) => file.size <= MAX_COMMENT_FILE_SIZE),
              );
            }}
          />
        </div>
      </CommentMentions>
      {fileError && <ErrorAlert message={fileError} />}
      {mutation.isError && <ErrorAlert message={mutation.error.message} />}
    </form>
  );
}
