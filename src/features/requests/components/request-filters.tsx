import { useState } from "react";
import { format, parse } from "date-fns";
import { useForm } from "react-hook-form";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/form/date-picker-field";
import { InputField } from "@/components/form/input-field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { requestFilterFields, type RequestFilters } from "../types";

export function RequestSearch({
  initialValue,
  initialStatus,
  statusOptions,
  statusLoading,
  onSearch,
}: Readonly<{
  initialValue: string;
  initialStatus: string;
  statusOptions: { value: string; label: string }[];
  statusLoading: boolean;
  onSearch: (value: string, status: string) => void;
}>) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState(initialStatus);
  return (
    <form
      role="search"
      aria-label="Tìm kiếm yêu cầu"
      className="flex min-w-[32rem] max-w-3xl flex-1 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(value.trim(), status);
      }}
    >
      <SearchInput
        label="Tìm kiếm yêu cầu"
        placeholder="Tìm kiếm nhanh..."
        value={value}
        onValueChange={setValue}
        wrapperClassName="flex-1"
      />
      <Select
        items={statusOptions}
        value={status}
        disabled={statusLoading}
        onValueChange={(next) => setStatus(next ?? "all")}
      >
        <SelectTrigger
          id="request-status"
          aria-label="Trạng thái"
          className="w-48 shrink-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit">Tìm kiếm</Button>
    </form>
  );
}

export function RequestFiltersForm({
  initialValues,
  onApply,
  onClear,
}: Readonly<{
  initialValues: RequestFilters;
  onApply: (filters: RequestFilters) => void;
  onClear: () => void;
}>) {
  const defaultValues: RequestFilters = {};
  for (const { name } of requestFilterFields)
    defaultValues[name] = initialValues[name] ?? "";
  const { control, handleSubmit } = useForm<RequestFilters>({ defaultValues });
  return (
    <form
      id="request-advanced-filters"
      aria-label="Lọc nâng cao"
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={handleSubmit((filters) => {
        const value = filters.duedate;
        const duedate = value
          ? format(
              parse(
                value,
                value.includes("-") ? "yyyy-MM-dd" : "d/M/yyyy",
                new Date(),
              ),
              "yyyy-MM-dd",
            )
          : "";
        onApply({ ...filters, duedate });
      })}
    >
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain p-4 sm:grid-cols-2 sm:p-6">
        {requestFilterFields.map((field) =>
          field.name === "duedate" ? (
            <DatePickerField
              key={field.name}
              control={control}
              name={field.name}
              id={`request-filter-${field.name}`}
              label={field.label}
              placeholder={field.placeholder}
              endYear={new Date().getFullYear() + 10}
            />
          ) : (
            <InputField
              key={field.name}
              control={control}
              name={field.name}
              id={`request-filter-${field.name}`}
              label={field.label}
              placeholder={field.placeholder}
            />
          ),
        )}
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
