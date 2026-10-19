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
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/65 transition-opacity data-closed:opacity-0" />
      <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain scroll-pt-28 scroll-pb-24 rounded-xl border border-border bg-card p-4 sm:p-6 text-foreground shadow-sm outline-none transition-all data-closed:scale-95 data-closed:opacity-0",
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
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "sticky -top-4 z-10 -mx-4 -mt-4 mb-5 flex items-start justify-between gap-3 border-b border-border bg-card p-4 sm:-top-6 sm:-mx-6 sm:-mt-6 sm:px-6 [&>div]:min-w-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "sticky -bottom-4 z-10 -mx-4 -mb-4 mt-6 flex flex-wrap justify-end gap-2 border-t border-border bg-card p-4 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6",
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
  return (
    <DialogPrimitive.Title
      className={cn("m-0 text-base font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: Readonly<DialogPrimitive.Description.Props>) {
  return (
    <DialogPrimitive.Description
      className={cn(
        "mt-1 wrap-break-word text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function DialogCloseButton({
  className,
  ...props
}: Readonly<DialogPrimitive.Close.Props>) {
  return (
    <DialogPrimitive.Close
      aria-label="Close dialog"
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
  DialogTitle,
  DialogTrigger,
};
