import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DialogHeading } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function DataFiltersPanel({
  open,
  onOpenChange,
  activeFilterCount,
  description,
  children,
  label,
  iconOnly = false,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeFilterCount: number;
  description: string;
  children: ReactNode;
  label?: string;
  iconOnly?: boolean;
}>) {
  const filterDescription =
    activeFilterCount > 0
      ? `${activeFilterCount} điều kiện lọc nâng cao đang áp dụng`
      : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "h-11 sm:h-10 sm:pointer-coarse:h-11",
              !iconOnly && (activeFilterCount > 0 || label)
                ? "w-auto gap-2 px-3"
                : "w-11 sm:w-10 sm:pointer-coarse:w-11",
            )}
            aria-label={label ?? "Lọc nâng cao"}
            aria-description={filterDescription}
            title={filterDescription ?? label ?? "Lọc nâng cao"}
          />
        }
      >
        <Filter className="size-4" aria-hidden="true" />
        {!iconOnly && label && <span>{label}</span>}
        {!iconOnly && activeFilterCount > 0 && (
          <Badge
            tone="brand"
            className="h-5 min-w-5 justify-center rounded-full px-1.5 py-0 tabular-nums"
            aria-hidden="true"
          >
            {activeFilterCount}
          </Badge>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-200 data-closed:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex justify-end">
          <Dialog.Popup className="flex h-dvh min-h-0 w-full max-w-lg flex-col border-l border-border bg-card text-foreground shadow-xl outline-none transition-transform duration-200 data-closed:translate-x-full motion-reduce:transition-none">
            <header className="flex shrink-0 items-center justify-between gap-3 p-4 sm:p-6">
              <DialogHeading
                icon={<Filter aria-hidden="true" />}
                title={label ?? "Lọc nâng cao"}
                description={description}
              />
              <Dialog.Close
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 sm:size-9 sm:pointer-coarse:size-11"
                    aria-label="Đóng bộ lọc nâng cao"
                  />
                }
              >
                <X className="size-4" aria-hidden="true" />
              </Dialog.Close>
            </header>
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
