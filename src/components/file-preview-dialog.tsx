import { t, useLocale } from "@/i18n";
import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button-variants";

type FilePreviewProps = (
  | { file: File; name?: never; url?: never }
  | { file?: never; name: string; url: string }
) & { onClose: () => void };

function previewKind(name: string, type = "") {
  if (
    type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|avif|bmp|ico)$/i.test(name)
  )
    return "image";
  if (type === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (type.startsWith("video/") || /\.(mp4|webm|ogv|mov)$/i.test(name))
    return "video";
  if (type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name))
    return "audio";
  if (/\.(txt|log|csv|json|md)$/i.test(name)) return "text";
  return "other";
}

export function FilePreviewDialog({
  file,
  name: remoteName,
  url,
  onClose,
}: Readonly<FilePreviewProps>) {
  useLocale();
  const name = file?.name ?? remoteName ?? t("common", "Tệp đính kèm");
  const kind = previewKind(name, file?.type);
  const [source, setSource] = useState(kind === "pdf" ? "" : (url ?? ""));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let objectUrl: string | undefined;
    const abort = new AbortController();
    setFailed(false);
    const createSource = (blob: Blob) => {
      // Native PDF viewers need an unsandboxed frame. Force the blob's MIME
      // type so a mislabelled upload cannot execute as an HTML document.
      let safe = blob;
      if (kind === "pdf") safe = new Blob([blob], { type: "application/pdf" });
      if (kind === "text")
        safe = new Blob([blob], { type: "text/plain;charset=utf-8" });
      objectUrl = URL.createObjectURL(safe);
      setSource(objectUrl);
    };
    if (file) createSource(file);
    else if (kind === "pdf") {
      setSource("");
      void fetch(url, { credentials: "omit", signal: abort.signal })
        .then((response) => {
          if (!response.ok) throw new Error(t("common", "Không tải được tệp."));
          return response.blob();
        })
        .then((blob) => {
          if (!abort.signal.aborted) createSource(blob);
        })
        .catch(() => {
          if (!abort.signal.aborted) setFailed(true);
        });
    } else {
      setSource(url);
    }
    return () => {
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, url, kind]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-w-5xl flex-col overflow-hidden p-1 sm:p-1">
        <div className="min-h-0 space-y-4 overflow-y-auto rounded-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogHeading
              icon={<FileText aria-hidden="true" />}
              title={name}
              description={t("common", "Xem tệp đính kèm.")}
            />
            <DialogCloseButton
              aria-label={
                kind === "image"
                  ? t("common", "Đóng xem trước ảnh")
                  : t("common", "Đóng xem tệp")
              }
            />
          </DialogHeader>
          {!source && !failed && (
            <p
              role="status"
              className="py-8 text-center text-sm text-muted-foreground"
            >
              {t("common", "Đang tải tệp...")}
            </p>
          )}
          {(source || failed) && (
            <PreviewContent
              kind={kind}
              source={source}
              name={name}
              failed={failed}
              onError={() => setFailed(true)}
            />
          )}
          {(source || url) && (
            <div className="flex justify-end">
              <a
                href={source || url}
                download={name}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                <Download aria-hidden="true" className="size-4" />
                {t("common", "Tải xuống")}
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewContent({
  kind,
  source,
  name,
  failed,
  onError,
}: Readonly<{
  kind: string;
  source: string;
  name: string;
  failed: boolean;
  onError: () => void;
}>) {
  useLocale();
  if (failed)
    return (
      <p
        role="status"
        className="py-8 text-center text-sm text-muted-foreground"
      >
        {kind === "image"
          ? t("common", "Không thể xem trước ảnh này.")
          : t(
              "common",
              "Không thể xem trước tệp này. Bạn có thể tải xuống để mở.",
            )}
      </p>
    );
  if (kind === "image")
    return (
      <img
        src={source}
        alt={name}
        onError={onError}
        className="mx-auto max-h-[65dvh] max-w-full object-contain"
      />
    );
  if (kind === "pdf")
    return (
      <iframe
        title={name}
        src={source}
        referrerPolicy="no-referrer"
        onError={onError}
        className="h-[65dvh] w-full rounded-lg border bg-white"
      />
    );
  if (kind === "text")
    return (
      <iframe
        title={name}
        src={source}
        sandbox=""
        referrerPolicy="no-referrer"
        onError={onError}
        className="h-[65dvh] w-full rounded-lg border bg-white"
      />
    );
  if (kind === "video")
    return (
      <video
        aria-label={name}
        src={source}
        controls
        onError={onError}
        className="mx-auto max-h-[65dvh] max-w-full rounded-lg"
      >
        <track kind="captions" />
      </video>
    );
  if (kind === "audio")
    return (
      <audio
        aria-label={name}
        src={source}
        controls
        onError={onError}
        className="w-full"
      >
        <track kind="captions" />
      </audio>
    );
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      <FileText aria-hidden="true" className="size-10" />
      <p className="max-w-full break-all font-medium text-foreground">{name}</p>
      <p>
        {t(
          "common",
          "Trình duyệt chưa hỗ trợ xem trước định dạng này. Bạn có thể tải xuống để mở.",
        )}
      </p>
    </div>
  );
}
