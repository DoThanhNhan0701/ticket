import { ErrorToast } from "@/components/error-toast";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { AsyncButton } from "@/components/ui/async-button";
import { uploadRequestAttachment } from "../api/create-request-api";
import type { RequestDetailData } from "../schemas/request-detail-schema";
import { RequestAttachments } from "./request-attachments";
import { TicketFiles } from "./ticket-files";
import { usePendingAttachments } from "../hooks/use-pending-attachments";

export function TicketAttachments({
  ticket,
  onSaved,
}: Readonly<{
  ticket: RequestDetailData;
  onSaved: () => Promise<unknown>;
}>) {
  const [files, setFiles] = useState<File[]>([]);
  usePendingAttachments(files.length);
  const pending = useRef<File[]>([]);
  const submitting = useRef(false);
  const uploadedCount = useRef(0);
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      while (pending.current.length) {
        await uploadRequestAttachment(ticket.id, pending.current[0]);
        uploadedCount.current += 1;
        pending.current.shift();
        setFiles([...pending.current]);
      }
    },
    onSuccess: () => {
      toast.success("Đã tải tệp đính kèm.");
    },
    onSettled: async () => {
      try {
        if (uploadedCount.current > 0) await onSaved();
      } catch {
        toast.error("Vui lòng tải lại yêu cầu để xem tệp đã lưu.");
      } finally {
        submitting.current = false;
      }
    },
  });
  const canUpload = [2, 3, 6].includes(ticket.ticket_status);
  const existingAttachments =
    Object.keys(ticket.attachment_files).length > 0 ? (
      <TicketFiles files={ticket.attachment_files} layout="tiles" />
    ) : null;
  return (
    <div className="min-w-0 space-y-3">
      {!existingAttachments && (
        <p className="text-sm text-muted-foreground">Không có tệp đính kèm.</p>
      )}
      {!canUpload && existingAttachments}
      {canUpload && (
        <>
          <RequestAttachments
            compact
            existingAttachments={existingAttachments}
            files={files}
            onChange={setFiles}
            disabled={mutation.isPending}
            actions={
              files.length > 0 && (
                <AsyncButton
                  type="button"
                  size="icon"
                  className="size-9 rounded-xl"
                  aria-label={
                    mutation.isError
                      ? "Tải lại tệp còn lại"
                      : "Tải lên đính kèm"
                  }
                  title={
                    mutation.isError
                      ? "Tải lại tệp còn lại"
                      : "Tải lên đính kèm"
                  }
                  loadingText={<span className="sr-only">Đang tải lên...</span>}
                  loading={mutation.isPending}
                  icon={<Upload className="size-4" />}
                  onClick={() => {
                    if (submitting.current) return;
                    if (files.some((file) => file.size > 50 * 1024 * 1024)) {
                      toast.error(
                        "Mỗi tệp đính kèm không được vượt quá 50 MB.",
                      );
                      return;
                    }
                    submitting.current = true;
                    uploadedCount.current = 0;
                    pending.current = [...files];
                    mutation.mutate();
                  }}
                >
                  <span className="sr-only">
                    {mutation.isError
                      ? "Tải lại tệp còn lại"
                      : "Tải lên đính kèm"}
                  </span>
                </AsyncButton>
              )
            }
          />
          {mutation.isError && <ErrorToast message={mutation.error.message} />}
        </>
      )}
    </div>
  );
}
