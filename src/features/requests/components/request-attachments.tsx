import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Paperclip, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImagePreviewDialog } from "@/components/image-preview-dialog";
import { FilePreviewDialog } from "@/components/file-preview-dialog";
import { FileAttachmentTile } from "./file-attachment-tile";

function isImageFile(file: File) {
  if (file.type) return file.type.startsWith("image/");
  return /\.(avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|webp)$/i.test(file.name);
}

function showAttachmentTiles(
  layout: "list" | "tiles" | undefined,
  compact: boolean,
) {
  return (layout ?? (compact ? "tiles" : "list")) === "tiles";
}

function attachmentLabelClass(compact: boolean, hidden?: boolean) {
  return compact || hidden
    ? "sr-only"
    : "flex items-center gap-2 text-sm font-semibold";
}

function pickerClassName(compact: boolean, style: "dropzone" | "inline") {
  if (compact)
    return "size-9 rounded-xl text-muted-foreground hover:text-foreground";
  if (style === "inline")
    return "min-h-11 w-full border-dashed text-primary hover:border-primary/50";
  return "h-auto min-h-28 w-full flex-col gap-2 border-dashed px-3 py-4 whitespace-normal text-center hover:border-primary/50";
}

function PickerContent({
  compact,
  style,
  description,
  multiple,
}: Readonly<{
  compact: boolean;
  style: "dropzone" | "inline";
  description?: string;
  multiple: boolean;
}>) {
  if (compact) return <Paperclip className="size-5" aria-hidden="true" />;
  if (style === "inline")
    return (
      <>
        <Paperclip className="size-5" aria-hidden="true" />
        <span>Thêm tệp đính kèm</span>
      </>
    );
  return (
    <>
      <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
      <span>Chọn tệp hoặc kéo thả vào đây</span>
      <span className="text-xs font-normal text-muted-foreground">
        {description ??
          (multiple ? "Có thể đính kèm nhiều tệp." : "Chọn một tệp đính kèm.")}
      </span>
    </>
  );
}

export function RequestAttachments({
  files,
  onChange,
  disabled,
  compact = false,
  layout,
  actions,
  existingAttachments,
  inputId,
  label = "Tệp đính kèm",
  hideLabel,
  previewAllFiles,
  multiple = true,
  description,
  pickerStyle = "dropzone",
}: Readonly<{
  files: File[];
  onChange: (files: File[]) => void;
  disabled: boolean;
  compact?: boolean;
  layout?: "list" | "tiles";
  actions?: ReactNode;
  existingAttachments?: ReactNode;
  inputId?: string;
  label?: string;
  hideLabel?: boolean;
  previewAllFiles?: boolean;
  multiple?: boolean;
  description?: string;
  pickerStyle?: "dropzone" | "inline";
}>) {
  const generatedId = useId();
  const id = inputId ?? generatedId;
  const input = useRef<HTMLInputElement>(null);
  const tiles = showAttachmentTiles(layout, compact);
  const [previewFile, setPreviewFile] = useState<File>();
  useEffect(() => {
    if (previewFile && !files.includes(previewFile)) setPreviewFile(undefined);
  }, [files, previewFile]);
  const addFiles = (selected: FileList | null) => {
    if (disabled) return;
    if (!multiple) {
      onChange(Array.from(selected ?? []).slice(0, 1));
      return;
    }
    const next = [...files];
    for (const file of Array.from(selected ?? []))
      if (
        !next.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified,
        )
      )
        next.push(file);
    onChange(next);
  };
  const picker = (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon" : "default"}
      title={compact ? "Đính kèm tệp" : undefined}
      disabled={disabled}
      aria-label={`Chọn ${label.toLowerCase()}`}
      className={pickerClassName(compact, pickerStyle)}
      onClick={() => input.current?.click()}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        addFiles(event.dataTransfer.files);
      }}
    >
      <PickerContent
        compact={compact}
        style={pickerStyle}
        description={description}
        multiple={multiple}
      />
    </Button>
  );
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className={attachmentLabelClass(compact, hideLabel)}>
        <Paperclip className="size-4" aria-hidden="true" />
        {label}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        tabIndex={-1}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {!compact && picker}
      {(existingAttachments || files.length > 0) && (
        <div
          className={
            tiles
              ? "flex min-w-0 flex-wrap items-start gap-2"
              : "min-w-0 space-y-2"
          }
        >
          {existingAttachments}
          {files.length > 0 && (
            <AttachmentList
              files={files}
              tiles={tiles}
              disabled={disabled}
              previewAllFiles={previewAllFiles}
              onPreview={setPreviewFile}
              onChange={onChange}
            />
          )}
        </div>
      )}
      {compact && (
        <div className="flex min-w-0 items-center justify-between gap-2">
          {picker}
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        </div>
      )}
      {previewFile &&
        files.includes(previewFile) &&
        (previewAllFiles ? (
          <FilePreviewDialog
            file={previewFile}
            onClose={() => setPreviewFile(undefined)}
          />
        ) : (
          <ImagePreviewDialog
            file={previewFile}
            onClose={() => setPreviewFile(undefined)}
          />
        ))}
    </div>
  );
}

function AttachmentList({
  files,
  tiles,
  disabled,
  previewAllFiles,
  onPreview,
  onChange,
}: Readonly<{
  files: File[];
  tiles: boolean;
  disabled: boolean;
  previewAllFiles?: boolean;
  onPreview: (file: File) => void;
  onChange: (files: File[]) => void;
}>) {
  return (
    <ul className={tiles ? "flex min-w-0 flex-wrap gap-2" : "space-y-2"}>
      {files.map((file, index) =>
        tiles ? (
          <FileAttachmentTile
            key={`${file.name}-${file.size}-${file.lastModified}`}
            file={file}
            name={file.name}
            image={isImageFile(file)}
            previewLabel={`${isImageFile(file) ? "Xem ảnh" : "Mở tệp"} ${file.name}`}
            disabled={disabled}
            onPreview={
              isImageFile(file) || previewAllFiles
                ? () => onPreview(file)
                : undefined
            }
            onRemove={() =>
              onChange(files.filter((_, position) => position !== index))
            }
          />
        ) : (
          <li
            key={`${file.name}-${file.size}-${file.lastModified}`}
            className="flex min-w-0 items-center gap-2 rounded-lg border border-border px-3 py-1"
          >
            {isImageFile(file) || previewAllFiles ? (
              <button
                type="button"
                aria-label={`${isImageFile(file) ? "Xem ảnh" : "Mở tệp"} ${file.name}`}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left text-sm underline-offset-4 hover:text-primary hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-ring"
                title={file.name}
                onClick={() => onPreview(file)}
              >
                <span className="min-w-0 truncate">{file.name}</span>
              </button>
            ) : (
              <span
                className="flex min-w-0 flex-1 items-center gap-2 text-sm"
                title={file.name}
              >
                <span className="min-w-0 truncate">{file.name}</span>
              </span>
            )}
            <span className="shrink-0 text-xs text-muted-foreground">
              {Math.max(1, Math.ceil(file.size / 1024))} KB
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              disabled={disabled}
              aria-label={`Bỏ tệp ${file.name}`}
              onClick={() =>
                onChange(files.filter((_, position) => position !== index))
              }
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </li>
        ),
      )}
    </ul>
  );
}
