import { t, useLocale } from "@/i18n";
import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { AsyncButton } from "./async-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogHeading,
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
  confirmText = t("common", "Confirm"),
  cancelText = t("common", "Cancel"),
  variant = "default",
  isLoading = false,
  onConfirm,
  icon,
}: Readonly<ConfirmDialogProps>) {
  useLocale();
  const isWarning = variant === "destructive" || variant === "warning";
  const Icon = isWarning ? AlertTriangle : Info;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogHeading
            icon={icon || <Icon aria-hidden="true" />}
            iconClassName={
              isWarning
                ? "border-warning-border bg-warning-soft text-warning"
                : undefined
            }
            title={title}
            description={description}
          />
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
