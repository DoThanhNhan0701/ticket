import { t, useLocale } from "@/i18n";
import { useEffect, useState } from "react";
import { Copy, FileText, Image, RotateCcw, X } from "lucide-react";
import { localizedToast as toast } from "@/i18n/toast";
import { Button } from "@/components/ui/button";
import { getFileTileColor } from "../utils/file-tile-color";

interface FileAttachmentTileProps {
  name: string;
  image: boolean;
  url?: string;
  file?: File;
  previewLabel?: string;
  onPreview?: () => void;
  onRemove?: () => void;
  onRestore?: () => void;
  removeLabel?: string;
  disabled?: boolean;
}
export function FileAttachmentTile({
  name,
  image,
  url,
  file,
  previewLabel = name,
  onPreview,
  onRemove,
  onRestore,
  removeLabel = t("attachments", "Bỏ tệp {0}", [name]),
  disabled,
}: Readonly<FileAttachmentTileProps>) {
  useLocale();
  const [localUrl, setLocalUrl] = useState("");
  const [failedSource, setFailedSource] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !image) return;
    const next = URL.createObjectURL(file);
    setLocalUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file, image]);
  const source = localUrl || url;
  const thumbnail = image && source && failedSource !== source;
  const content = (
    <>
      {thumbnail ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailedSource(source)}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`flex size-full min-w-0 flex-col items-center justify-center gap-1 p-2 ${image ? "bg-muted/30 text-muted-foreground" : getFileTileColor(name)}`}
        >
          {image ? (
            <Image className="size-6" />
          ) : (
            <FileText className="size-6" />
          )}
          <span className="max-w-full truncate text-[10px] font-medium uppercase">
            {name.includes(".") ? name.split(".").pop() : "File"}
          </span>
        </span>
      )}
      <span className="sr-only">{name}</span>
    </>
  );
  const className = `flex size-full items-center justify-center overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${onRestore ? "opacity-40 grayscale" : ""}`;
  let action = (
    <span role="img" aria-label={name} title={name} className={className}>
      {content}
    </span>
  );
  if (onPreview && !onRestore)
    action = (
      <button
        type="button"
        aria-label={previewLabel}
        title={name}
        disabled={disabled}
        className={className}
        onClick={onPreview}
      >
        {content}
      </button>
    );
  else if (url && !onRestore)
    action = (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={name}
        title={name}
        className={className}
      >
        {content}
      </a>
    );
  return (
    <li className="group/file relative size-18 shrink-0 rounded-xl border border-border bg-muted/20">
      {action}
      {url && !onRestore && (
        <CopyFileLink name={name} url={url} disabled={disabled} />
      )}
      <FileTileAction
        name={name}
        removeLabel={removeLabel}
        onRemove={onRemove}
        onRestore={onRestore}
        disabled={disabled}
      />
    </li>
  );
}

function CopyFileLink({
  name,
  url,
  disabled,
}: Readonly<{ name: string; url: string; disabled?: boolean }>) {
  useLocale();
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title={t("attachments", "Sao chép liên kết")}
      aria-label={t("attachments", "Sao chép liên kết {0}", [name])}
      disabled={disabled}
      className="pointer-events-none absolute right-1 bottom-1 z-10 size-7 rounded-md bg-card/95 opacity-0 shadow-xs group-hover/file:pointer-events-auto group-hover/file:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast.success(t("attachments", "Đã sao chép liên kết tệp."));
        } catch {
          toast.error(
            t("attachments", "Không thể sao chép liên kết. Vui lòng thử lại."),
          );
        }
      }}
    >
      <Copy className="size-3.5" aria-hidden="true" />
    </Button>
  );
}

function FileTileAction({
  name,
  removeLabel,
  onRemove,
  onRestore,
  disabled,
}: Readonly<
  Pick<
    FileAttachmentTileProps,
    "name" | "removeLabel" | "onRemove" | "onRestore" | "disabled"
  >
>) {
  useLocale();
  if (!onRemove && !onRestore) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="absolute top-0.5 right-0.5 z-10 size-6 rounded-full bg-card/95 shadow-xs"
      disabled={disabled}
      aria-label={
        onRestore ? t("attachments", "Khôi phục tệp {0}", [name]) : removeLabel
      }
      title={
        onRestore
          ? t("attachments", "Khôi phục tệp")
          : t("attachments", "Bỏ tệp")
      }
      onClick={onRestore || onRemove}
    >
      {onRestore ? (
        <RotateCcw className="size-3" aria-hidden="true" />
      ) : (
        <X className="size-3" aria-hidden="true" />
      )}
    </Button>
  );
}
