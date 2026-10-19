import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
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
  const getIcon = () => {
    if (icon) return icon;
    if (variant === "destructive" || variant === "warning") {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-soft border border-warning-border text-warning shrink-0">
          <AlertTriangle className="h-4 w-4" />
        </div>
      );
    }
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent border border-border text-accent-foreground shrink-0">
        <Info className="h-4 w-4" />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getIcon()}
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
