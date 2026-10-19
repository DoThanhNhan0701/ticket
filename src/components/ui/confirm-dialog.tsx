import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { AsyncButton } from "./async-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive" | "warning";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  icon?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
  onConfirm,
  icon,
}: Readonly<ConfirmDialogProps>) {
  const isWarning = variant === "destructive" || variant === "warning";
  const Icon = isWarning ? AlertTriangle : Info;
  const defaultIcon = (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
        isWarning
          ? "bg-warning-soft border-warning-border text-warning"
          : "bg-accent border-border text-accent-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {icon || defaultIcon}
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogDescription>
            </div>
          </div>
          <DialogCloseButton />
        </DialogHeader>

        <DialogFooter className="pt-2">
          <DialogClose
            render={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isLoading}
              />
            }
          >
            {cancelText}
          </DialogClose>
          <AsyncButton
            loading={isLoading}
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            size="sm"
            disabled={isLoading}
            onClick={onConfirm}
          >
            {confirmText}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
