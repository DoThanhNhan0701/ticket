import { useId } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/form/date-picker-field";
import { InputField } from "@/components/form/input-field";
import { SelectField } from "@/components/form/select-field";
import { getFilterValues, normalizeFilterValues } from "./utils";
import type { DataFilterField, DataFilterValues } from "./types";

export function DataFiltersForm<Name extends string>({
  fields,
  initialValues,
  onApply,
  onClear,
}: Readonly<{
  fields: readonly DataFilterField<Name>[];
  initialValues: DataFilterValues<Name>;
  onApply: (filters: DataFilterValues<Name>) => void;
  onClear: () => void;
}>) {
  const formId = useId();
  const { control, handleSubmit } = useForm<DataFilterValues>({
    defaultValues: getFilterValues(fields, initialValues),
  });
  return (
    <form
      aria-label="Lọc nâng cao"
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={handleSubmit((filters) =>
        onApply(normalizeFilterValues(fields, filters)),
      )}
    >
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain p-4 sm:grid-cols-2 sm:p-6">
        {fields.map((field) => {
          const props = {
            control,
            name: field.name,
            id: `${formId}-${field.name}`,
            label: field.label,
            placeholder: field.placeholder,
          };
          if (field.type === "date")
            return (
              <DatePickerField
                key={field.name}
                {...props}
                endYear={new Date().getFullYear() + 10}
              />
            );
          if (field.type === "select")
            return (
              <SelectField
                key={field.name}
                {...props}
                options={[...(field.options ?? [])]}
                isLoading={field.isLoading}
                searchable={field.searchable}
                noDataText="Không có lựa chọn"
              />
            );
          return <InputField key={field.name} {...props} />;
        })}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border p-4 sm:p-6">
        <Button type="submit">Áp dụng bộ lọc</Button>
        <Button type="button" variant="outline" onClick={onClear}>
          Xóa bộ lọc nâng cao
        </Button>
      </div>
    </form>
  );
}
