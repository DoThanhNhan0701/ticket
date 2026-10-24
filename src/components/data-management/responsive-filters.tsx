import { t, useLocale } from "@/i18n";
import { MobilePageAction } from "@/components/layout/mobile-page-action";
import { useEffect, useRef, type ReactNode } from "react";
import { DataFiltersPanel } from "./data-filters-panel";

export function ResponsiveFilters({
  mobile,
  open,
  onOpenChange,
  activeCount,
  actions,
  actionsInHeader = true,
  children,
}: Readonly<{
  mobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  actions?: ReactNode;
  actionsInHeader?: boolean;
  children: ReactNode;
}>) {
  useLocale();
  const wasMobile = useRef(mobile);
  useEffect(() => {
    if (wasMobile.current && !mobile && open) onOpenChange(false);
    wasMobile.current = mobile;
  }, [mobile, open, onOpenChange]);
  if (!mobile) return children;
  const filter = (
    <DataFiltersPanel
      iconOnly
      open={open}
      onOpenChange={onOpenChange}
      activeFilterCount={activeCount}
      label={t("common", "Tìm kiếm nâng cao")}
      description={t(
        "common",
        "Nhập từ khóa và chọn các điều kiện để tìm kiếm.",
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {children}
      </div>
    </DataFiltersPanel>
  );
  if (!actions) return <MobilePageAction>{filter}</MobilePageAction>;
  const toolbar = (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      {actions}
      {filter}
    </div>
  );
  return actionsInHeader ? (
    <MobilePageAction>{toolbar}</MobilePageAction>
  ) : (
    toolbar
  );
}
