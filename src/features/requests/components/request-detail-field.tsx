import { useWatch, type UseFormReturn } from "react-hook-form";
import { InputField } from "@/components/form/input-field";
import { SelectField } from "@/components/form/select-field";
import { DatePickerField } from "@/components/form/date-picker-field";
import {
  fieldOptions,
  isDetailDateDisabled,
  type detailFields,
} from "../utils/request-detail-data";
import type { CreateRequestValues } from "../schemas/create-request-schema";

export function RequestDetailField({
  form,
  field,
  fields,
  row,
  disabled,
}: Readonly<{
  form: UseFormReturn<CreateRequestValues>;
  field: ReturnType<typeof detailFields>[number];
  fields: ReturnType<typeof detailFields>;
  row: number;
  disabled: boolean;
}>) {
  const values =
    useWatch({ control: form.control, name: `rows.${row}.values` }) ?? {};
  const dateDisabled = (date: Date, part: "start" | "end" = "start") =>
    isDetailDateDisabled(date, field, { values }, fields, part);
  const name = `rows.${row}.values.${field.fieldKey}` as const;
  const id = `detail-${row}-${field.fieldKey}`;
  const shared = {
    control: form.control,
    name,
    id,
    label: field.title,
    required: field.required,
    disabled,
  };
  const options = fieldOptions(field).map((value) => ({ value, label: value }));
  if (options.length)
    return (
      <SelectField
        {...shared}
        searchable
        options={options}
        placeholder="Chọn giá trị"
      />
    );
  if (field.type === "date-text")
    return (
      <DatePickerField
        {...shared}
        endYear={new Date().getFullYear() + 10}
        isDateDisabled={dateDisabled}
      />
    );
  if (field.type === "range-date-text")
    return (
      <div className="grid min-w-0 grid-cols-2 gap-3">
        <DatePickerField
          {...shared}
          name={`${name}_start`}
          id={`${id}-start`}
          label={`${field.title} - Từ ngày`}
          isDateDisabled={dateDisabled}
          endYear={new Date().getFullYear() + 10}
        />
        <DatePickerField
          {...shared}
          name={`${name}_end`}
          id={`${id}-end`}
          label={`${field.title} - Đến ngày`}
          isDateDisabled={(date) => dateDisabled(date, "end")}
          endYear={new Date().getFullYear() + 10}
        />
      </div>
    );
  return (
    <InputField
      {...shared}
      type={field.type === "number" ? "number" : "text"}
      placeholder={`Nhập ${field.title.toLowerCase()}`}
    />
  );
}
