import type { SubmitEvent, ReactNode } from "react";
import { DataFiltersPanel } from "@/components/data-management/data-filters-panel";
import { Button } from "@/components/ui/button";

export function RecruitmentAdvancedDrawer({
  open,
  disabled,
  onOpenChange,
  activeCount,
  onApply,
  onClear,
  children,
}: Readonly<{
  open: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  onApply: (event: SubmitEvent<HTMLFormElement>) => void | Promise<void>;
  onClear: () => void;
  children: ReactNode;
}>) {
  return (
    <DataFiltersPanel
      open={open}
      onOpenChange={onOpenChange}
      activeFilterCount={activeCount}
      description="Lọc dữ liệu tuyển dụng theo các thông tin bên dưới."
    >
      <form
        aria-label="Lọc nâng cao"
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.stopPropagation();
          void onApply(event);
        }}
      >
        <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain p-4 sm:grid-cols-2 sm:p-6">
          {children}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 p-4 sm:p-6">
          <Button type="submit" disabled={disabled}>
            Áp dụng bộ lọc
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={onClear}
          >
            Xóa bộ lọc nâng cao
          </Button>
        </div>
      </form>
    </DataFiltersPanel>
  );
}
