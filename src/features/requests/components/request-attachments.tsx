import { useEffect, useRef, useState } from "react";
import { Paperclip, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImagePreviewDialog } from "@/components/image-preview-dialog";

function isImageFile(file: File) {
  if (file.type) return file.type.startsWith("image/");
  return /\.(avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|webp)$/i.test(file.name);
}

export function RequestAttachments({
  files,
  onChange,
  disabled,
}: Readonly<{
  files: File[];
  onChange: (files: File[]) => void;
  disabled: boolean;
}>) {
  const input = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<File>();
  useEffect(() => {
    if (previewFile && !files.includes(previewFile)) setPreviewFile(undefined);
  }, [files, previewFile]);
  const addFiles = (selected: FileList | null) => {
    if (disabled) return;
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
  return (
    <div className="min-w-0 space-y-2">
      <label
        htmlFor="create-attachments"
        className="flex items-center gap-2 text-sm font-semibold"
      >
        <Paperclip className="size-4" aria-hidden="true" />
        Tệp đính kèm
      </label>
      <input
        ref={input}
        id="create-attachments"
        type="file"
        tabIndex={-1}
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        aria-label="Chọn tệp đính kèm"
        className="h-auto min-h-28 w-full flex-col gap-2 border-dashed px-3 py-4 whitespace-normal text-center hover:border-primary/50"
        onClick={() => input.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          addFiles(event.dataTransfer.files);
        }}
      >
        <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
        <span>Chọn tệp hoặc kéo thả vào đây</span>
        <span className="text-xs font-normal text-muted-foreground">
          Có thể đính kèm nhiều tệp.
        </span>
      </Button>
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-border px-3 py-1"
            >
              {isImageFile(file) ? (
                <button
                  type="button"
                  aria-label={`Xem ảnh ${file.name}`}
                  className="min-h-11 min-w-0 flex-1 truncate text-left text-sm underline-offset-4 hover:text-primary hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-ring"
                  title={file.name}
                  onClick={() => setPreviewFile(file)}
                >
                  {file.name}
                </button>
              ) : (
                <span
                  className="min-w-0 flex-1 truncate text-sm"
                  title={file.name}
                >
                  {file.name}
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
          ))}
        </ul>
      )}
      {previewFile && files.includes(previewFile) && (
        <ImagePreviewDialog
          file={previewFile}
          onClose={() => setPreviewFile(undefined)}
        />
      )}
    </div>
  );
}
