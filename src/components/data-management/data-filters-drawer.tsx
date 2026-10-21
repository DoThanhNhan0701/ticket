import { useIsMobile } from "@/hooks/use-is-mobile";
import { useState } from "react";
import { DataFiltersPanel } from "./data-filters-panel";
import { DataFiltersForm } from "./data-filters-form";
import { countActiveFilters } from "./utils";
import type { DataFilterField, DataFilterValues } from "./types";

export function DataFiltersDrawer<Name extends string>({
  fields,
  description = "Lọc dữ liệu theo các thông tin bên dưới.",
  initialValues,
  onApply,
  onClear,
  label,
  activeFilterCount,
  iconOnly,
}: Readonly<{
  fields: readonly DataFilterField<Name>[];
  description?: string;
  initialValues: DataFilterValues<Name>;
  onApply: (filters: DataFilterValues<Name>) => void;
  onClear: () => void;
  label?: string;
  activeFilterCount?: number;
  iconOnly?: boolean;
}>) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  return (
    <DataFiltersPanel
      open={open}
      onOpenChange={setOpen}
      activeFilterCount={
        activeFilterCount ?? countActiveFilters(fields, initialValues)
      }
      label={label}
      iconOnly={iconOnly}
      description={description}
    >
      <DataFiltersForm
        fields={fields}
        key={JSON.stringify(initialValues)}
        initialValues={initialValues}
        onApply={(filters) => {
          onApply(filters);
          setOpen(false);
        }}
        onCancel={mobile ? () => setOpen(false) : undefined}
        onClear={() => {
          onClear();
          setOpen(false);
        }}
      />
    </DataFiltersPanel>
  );
}
