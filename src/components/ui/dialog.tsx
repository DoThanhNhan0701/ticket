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
            "max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain scroll-pt-28 scroll-pb-24 rounded-lg border border-border bg-card p-2.5 sm:p-3.5 text-foreground shadow-xl outline-none transition-all data-closed:scale-95 data-closed:opacity-0 data-nested-dialog-open:blur-[1px] data-nested-dialog-open:brightness-90",
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
        "sticky -top-2.5 z-10 -mx-2.5 -mt-2.5 mb-2.5 flex items-center justify-between gap-2 bg-card p-2.5 pb-0 sm:-top-3.5 sm:-mx-3.5 sm:-mt-3.5 sm:px-3.5 [&>div]:min-w-0",
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
        "sticky -bottom-2.5 z-10 -mx-2.5 -mb-2.5 mt-3 flex flex-wrap justify-end gap-1.5 bg-card p-2.5 sm:-bottom-3.5 sm:-mx-3.5 sm:-mb-3.5 sm:px-3.5",
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
      className={cn("m-0 text-[0.8125rem] leading-4 font-semibold", className)}
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
        "mt-0 wrap-break-word text-[0.6875rem] leading-3.5 text-muted-foreground",
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
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg border [&>svg]:size-3.5",
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
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
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
