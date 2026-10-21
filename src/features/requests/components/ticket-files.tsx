import { useState } from "react";
import { FileText, Image } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { ticketFileUrl } from "../utils/ticket-detail";
import { FileAttachmentTile } from "./file-attachment-tile";

interface TicketFilesProps {
  files: Record<string, string>;
  layout?: "list" | "tiles";
  removedFiles?: string[];
  onRemove?: (name: string) => void;
  onRestore?: (name: string) => void;
  disabled?: boolean;
}

export function TicketFiles({
  files,
  layout = "list",
  removedFiles = [],
  onRemove,
  onRestore,
  disabled,
}: Readonly<TicketFilesProps>) {
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  return (
    <>
      <ul
        className={
          layout === "tiles"
            ? "flex min-w-0 flex-wrap gap-2"
            : "grid min-w-0 gap-2"
        }
      >
        {Object.entries(files).map(([name, source]) => {
          const url = ticketFileUrl(source);
          const image = /\.(?:png|jpe?g|gif|webp|avif|bmp)$/i.test(name);
          if (layout === "tiles")
            return (
              <FileAttachmentTile
                key={name}
                name={name}
                url={url}
                image={image}
                disabled={disabled}
                removeLabel={`Bỏ tệp cũ ${name}`}
                onRemove={onRemove ? () => onRemove(name) : undefined}
                onRestore={
                  removedFiles.includes(name) && onRestore
                    ? () => onRestore(name)
                    : undefined
                }
                onPreview={
                  url && image
                    ? () => {
                        setFailed(false);
                        setPreview({ name, url });
                      }
                    : undefined
                }
              />
            );
          const content = (
            <>
              <span className="shrink-0" aria-hidden="true">
                {image ? (
                  <Image className="size-4" />
                ) : (
                  <FileText className="size-4" />
                )}
              </span>
              <span className="min-w-0 truncate">{name}</span>
            </>
          );
          const className =
            "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-muted";
          let action = (
            <span className={className} title={name}>
              {content}
            </span>
          );
          if (url && image)
            action = (
              <button
                type="button"
                title={name}
                aria-label={name}
                className={className}
                onClick={() => {
                  setFailed(false);
                  setPreview({ name, url });
                }}
              >
                {content}
              </button>
            );
          else if (url)
            action = (
              <a
                href={url}
                title={name}
                aria-label={name}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {content}
              </a>
            );
          return (
            <li key={name} className="min-w-0 rounded-lg border border-border">
              {action}
            </li>
          );
        })}
      </ul>
      {preview && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
        >
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogHeading
                icon={<Image aria-hidden="true" />}
                title={preview.name}
                description="Xem trước hình ảnh đính kèm."
              />
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
              <img
                src={preview.url}
                alt={preview.name}
                className="mx-auto max-h-[70dvh] max-w-full object-contain"
                onError={() => setFailed(true)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
