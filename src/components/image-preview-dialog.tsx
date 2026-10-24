import { t, useLocale } from "@/i18n";
import { useEffect, useState } from "react";
import { Image } from "lucide-react";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogHeading,
} from "@/components/ui/dialog";

export function ImagePreviewDialog({
  file,
  onClose,
}: Readonly<{ file: File; onClose: () => void }>) {
  useLocale();
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
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogHeading
            icon={<Image aria-hidden="true" />}
            title={file.name}
            description={t("common", "Xem trước hình ảnh đính kèm.")}
          />
          <DialogCloseButton aria-label={t("common", "Đóng xem trước ảnh")} />
        </DialogHeader>
        {failed ? (
          <p
            role="status"
            className="py-8 text-center text-sm text-muted-foreground"
          >
            {t("common", "Không thể xem trước ảnh này.")}
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
