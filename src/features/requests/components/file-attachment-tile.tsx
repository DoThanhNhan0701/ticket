import { useEffect, useState } from "react";
import { FileText, Image, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  removeLabel = `Bỏ tệp ${name}`,
  disabled,
}: Readonly<FileAttachmentTileProps>) {
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
    <span role="img" aria-label={name} className={className}>
      {content}
    </span>
  );
  if (onPreview && !onRestore)
    action = (
      <button
        type="button"
        aria-label={previewLabel}
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
        className={className}
      >
        {content}
      </a>
    );
  return (
    <li className="relative size-18 shrink-0 rounded-xl border border-border bg-muted/20">
      <Tooltip>
        <TooltipTrigger render={action} />
        <TooltipContent className="whitespace-normal wrap-anywhere">
          {name}
        </TooltipContent>
      </Tooltip>
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
  if (!onRemove && !onRestore) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="absolute top-0.5 right-0.5 z-10 size-6 rounded-full bg-card/95 shadow-xs"
      disabled={disabled}
      aria-label={onRestore ? `Khôi phục tệp ${name}` : removeLabel}
      title={onRestore ? "Khôi phục tệp" : "Bỏ tệp"}
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
