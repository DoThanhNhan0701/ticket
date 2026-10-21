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
}: Readonly<{
  fields: readonly DataFilterField<Name>[];
  description?: string;
  initialValues: DataFilterValues<Name>;
  onApply: (filters: DataFilterValues<Name>) => void;
  onClear: () => void;
}>) {
  const [open, setOpen] = useState(false);
  return (
    <DataFiltersPanel
      open={open}
      onOpenChange={setOpen}
      activeFilterCount={countActiveFilters(fields, initialValues)}
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
        onClear={() => {
          onClear();
          setOpen(false);
        }}
      />
    </DataFiltersPanel>
  );
}
