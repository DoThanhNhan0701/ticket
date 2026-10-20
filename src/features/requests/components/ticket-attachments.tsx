import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { AsyncButton } from "@/components/ui/async-button";
import { ErrorAlert } from "@/components/error-alert";
import { uploadRequestAttachment } from "../api/create-request-api";
import type { RequestDetailData } from "../schemas/request-detail-schema";
import { RequestAttachments } from "./request-attachments";
import { TicketFiles } from "./ticket-files";

export function TicketAttachments({
  ticket,
  onSaved,
}: Readonly<{
  ticket: RequestDetailData;
  onSaved: () => Promise<unknown>;
}>) {
  const [files, setFiles] = useState<File[]>([]);
  const pending = useRef<File[]>([]);
  const submitting = useRef(false);
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      while (pending.current.length) {
        await uploadRequestAttachment(ticket.id, pending.current[0]);
        pending.current.shift();
        setFiles([...pending.current]);
      }
    },
    onSuccess: () => {
      toast.success("Đã tải tệp đính kèm.");
    },
    onSettled: async () => {
      try {
        await onSaved();
      } catch {
        toast.error("Vui lòng tải lại yêu cầu để xem tệp đã lưu.");
      } finally {
        submitting.current = false;
      }
    },
  });
  return (
    <div className="min-w-0 space-y-3">
      {Object.keys(ticket.attachment_files).length ? (
        <TicketFiles files={ticket.attachment_files} />
      ) : (
        <p className="text-sm text-muted-foreground">Không có tệp đính kèm.</p>
      )}
      {[2, 3, 6].includes(ticket.ticket_status) && (
        <>
          <RequestAttachments
            files={files}
            onChange={setFiles}
            disabled={mutation.isPending}
          />
          {files.length > 0 && (
            <AsyncButton
              type="button"
              loading={mutation.isPending}
              icon={<Upload className="size-4" />}
              onClick={() => {
                if (submitting.current) return;
                if (files.some((file) => file.size > 50 * 1024 * 1024)) {
                  toast.error("Mỗi tệp đính kèm không được vượt quá 50 MB.");
                  return;
                }
                submitting.current = true;
                pending.current = [...files];
                mutation.mutate();
              }}
            >
              {mutation.isError ? "Tải lại tệp còn lại" : "Tải lên đính kèm"}
            </AsyncButton>
          )}
          {mutation.isError && <ErrorAlert message={mutation.error.message} />}
        </>
      )}
    </div>
  );
}
