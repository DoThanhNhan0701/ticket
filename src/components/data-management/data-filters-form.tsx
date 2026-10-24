import { t, useLocale } from "@/i18n";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/form/date-picker-field";
import { InputField } from "@/components/form/input-field";
import { SelectField } from "@/components/form/select-field";
import { MultiSelectField } from "@/components/form/multi-select-field";
import { getFilterValues, normalizeFilterValues } from "./utils";
import type { DataFilterField, DataFilterValues } from "./types";

export function DataFiltersForm<Name extends string>({
  fields,
  initialValues,
  onApply,
  onClear,
  onCancel,
}: Readonly<{
  fields: readonly DataFilterField<Name>[];
  initialValues: DataFilterValues<Name>;
  onApply: (filters: DataFilterValues<Name>) => void;
  onClear: () => void;
  onCancel?: () => void;
}>) {
  useLocale();
  const formId = useId();
  const { control, handleSubmit } = useForm<DataFilterValues>({
    defaultValues: getFilterValues(fields, initialValues),
  });
  return (
    <form
      aria-label={t("common", "Lọc nâng cao")}
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
                noDataText={t("common", "Không có lựa chọn")}
              />
            );
          if (field.type === "multi-select")
            return (
              <MultiSelectField
                key={field.name}
                {...props}
                options={[...(field.options ?? [])]}
                isLoading={field.isLoading}
                valueFormat="csv"
                noDataText={t("common", "Không có lựa chọn")}
                maxBadgeCount={2}
              />
            );
          return <InputField key={field.name} {...props} />;
        })}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 p-4 sm:flex sm:flex-wrap sm:p-6">
        <Button
          title={
            onCancel ? t("common", "Tìm kiếm") : t("common", "Áp dụng bộ lọc")
          }
          type="submit"
        >
          {onCancel ? t("common", "Tìm kiếm") : t("common", "Áp dụng bộ lọc")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel ?? onClear}>
          {onCancel ? t("common", "Hủy") : t("common", "Xóa bộ lọc nâng cao")}
        </Button>
      </div>
    </form>
  );
}
