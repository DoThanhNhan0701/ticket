import { useEffect, useState } from "react";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ImagePreviewDialog({
  file,
  onClose,
}: Readonly<{ file: File; onClose: () => void }>) {
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSource(url);
    setFailed(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-5xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle
            className="min-w-0 flex-1 self-center truncate"
            title={file.name}
          >
            {file.name}
          </DialogTitle>
          <DialogCloseButton aria-label="Đóng xem trước ảnh" />
        </DialogHeader>
        {failed ? (
          <p
            role="status"
            className="py-8 text-center text-sm text-muted-foreground"
          >
            Không thể xem trước ảnh này.
          </p>
        ) : (
          source && (
            <img
              src={source}
              alt={file.name}
              className="mx-auto max-h-[70dvh] max-w-full object-contain"
              onError={() => setFailed(true)}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
