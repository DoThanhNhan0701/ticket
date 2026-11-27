import { t, useLocale } from "@/i18n";
import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogContent({
  className,
  children,
  ...props
}: Readonly<DialogPrimitive.Popup.Props>) {
  useLocale();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/65 transition-opacity data-closed:opacity-0" />
      <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain scroll-pt-28 scroll-pb-24 rounded-xl border border-border bg-card p-3 sm:p-4 text-foreground shadow-xl outline-none transition-all data-closed:scale-95 data-closed:opacity-0 data-nested-dialog-open:blur-[1px] data-nested-dialog-open:brightness-90",
            className,
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  useLocale();
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "sticky -top-3 z-10 -mx-3 -mt-3 mb-3 flex items-center justify-between gap-3 bg-card p-3 pb-0 sm:-top-4 sm:-mx-4 sm:-mt-4 sm:px-4 [&>div]:min-w-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  useLocale();
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "sticky -bottom-3 z-10 -mx-3 -mb-3 mt-4 flex flex-wrap justify-end gap-2 bg-card p-3 sm:-bottom-4 sm:-mx-4 sm:-mb-4 sm:px-4",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: Readonly<DialogPrimitive.Title.Props>) {
  useLocale();
  return (
    <DialogPrimitive.Title
      className={cn("m-0 text-sm leading-5 font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: Readonly<DialogPrimitive.Description.Props>) {
  useLocale();
  return (
    <DialogPrimitive.Description
      className={cn(
        "mt-0 wrap-break-word text-xs leading-4 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function DialogHeading({
  icon,
  iconClassName,
  title,
  description,
  descriptionId,
}: Readonly<{
  icon: React.ReactNode;
  iconClassName?: string;
  title: React.ReactNode;
  description: React.ReactNode;
  descriptionId?: string;
}>) {
  useLocale();
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl border [&>svg]:size-5",
          iconClassName ??
            "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-200",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <DialogTitle
          className="truncate"
          title={typeof title === "string" ? title : undefined}
        >
          {title}
        </DialogTitle>
        <DialogDescription id={descriptionId}>{description}</DialogDescription>
      </div>
    </div>
  );
}

function DialogCloseButton({
  className,
  ...props
}: Readonly<DialogPrimitive.Close.Props>) {
  useLocale();
  return (
    <DialogPrimitive.Close
      aria-label={t("common", "Close dialog")}
      className={cn(
        "flex h-11 w-11 shrink-0 sm:h-8 sm:w-8 sm:pointer-coarse:h-11 sm:pointer-coarse:w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
      {...props}
    >
      <X className="h-4 w-4" />
    </DialogPrimitive.Close>
  );
}

export {
  Dialog,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeading,
  DialogTitle,
  DialogTrigger,
};
