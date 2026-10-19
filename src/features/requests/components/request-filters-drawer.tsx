import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { requestFilterFields, type RequestFilters } from "../types";
import { RequestFiltersForm } from "./request-filters";

export function RequestFiltersDrawer({
  initialValues,
  onApply,
  onClear,
}: Readonly<{
  initialValues: RequestFilters;
  onApply: (filters: RequestFilters) => void;
  onClear: () => void;
}>) {
  const [open, setOpen] = useState(false);
  const activeFilterCount = requestFilterFields.filter(({ name }) =>
    initialValues[name]?.trim(),
  ).length;
  const filterDescription =
    activeFilterCount > 0
      ? `${activeFilterCount} điều kiện lọc nâng cao đang áp dụng`
      : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "h-11 sm:h-10 sm:pointer-coarse:h-11",
              activeFilterCount > 0
                ? "w-auto gap-2 px-3"
                : "w-11 sm:w-10 sm:pointer-coarse:w-11",
            )}
            aria-label="Lọc nâng cao"
            aria-description={filterDescription}
            title={filterDescription ?? "Lọc nâng cao"}
          />
        }
      >
        <Filter className="size-4" aria-hidden="true" />
        {activeFilterCount > 0 && (
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
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-4 sm:p-6">
              <div className="space-y-1">
                <Dialog.Title className="text-lg font-semibold">
                  Lọc nâng cao
                </Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  Lọc yêu cầu theo các thông tin bên dưới.
                </Dialog.Description>
              </div>
              <Dialog.Close
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Đóng bộ lọc nâng cao"
                  />
                }
              >
                <X className="size-4" aria-hidden="true" />
              </Dialog.Close>
            </header>
            <RequestFiltersForm
              key={JSON.stringify(initialValues)}
              initialValues={initialValues}
              onApply={(filters) => {
                onApply(filters);
                setOpen(false);
              }}
              onClear={() => {
                onClear();
                setOpen(false);
              }}
            />
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
