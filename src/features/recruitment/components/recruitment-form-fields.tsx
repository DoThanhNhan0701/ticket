import { type UseFormReturn } from "react-hook-form";

import { InputField } from "@/components/form/input-field";
import { DatePickerField } from "@/components/form/date-picker-field";
import { SelectField } from "@/components/form/select-field";
import { MultiSelectField } from "@/components/form/multi-select-field";
import { TextareaField } from "@/components/form/textarea-field";

import { TimePickerField } from "@/components/form/time-picker-field";

import type {
  RecruitmentField,
  RecruitmentLookups,
  RecruitmentValues,
} from "../types";
export function RecruitmentFormFields({
  fields,
  form,
  lookups,
  disabled,
}: Readonly<{
  fields: RecruitmentField[];
  form: UseFormReturn<RecruitmentValues>;
  lookups: RecruitmentLookups;
  disabled: boolean;
}>) {
  const options = {
    ...lookups,
    genders: [
      { value: "Nam", label: "Nam" },
      { value: "Nữ", label: "Nữ" },
    ],
  };
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const shared = {
          control: form.control,
          id: `recruitment-${field.name}`,
          name: field.name,
          label: field.label,
          placeholder: fieldPlaceholder(field),
          required: field.required,
          disabled: disabled || field.readonly,
        };
        if (field.readonly && field.lookup)
          return <InputField key={field.name} {...shared} />;
        if (field.type === "date")
          return (
            <DatePickerField
              key={field.name}
              {...shared}
              endYear={new Date().getFullYear() + 5}
            />
          );
        if (field.type === "select")
          return (
            <SelectField
              key={field.name}
              {...shared}
              searchable
              options={[
                ...(!field.required
                  ? [{ value: "", label: "Không chọn" }]
                  : []),
                ...(options[field.lookup! as keyof typeof options] ?? []),
              ]}
            />
          );
        if (field.type === "multi")
          return (
            <MultiSelectField
              key={field.name}
              {...shared}
              options={options[field.lookup! as keyof typeof options] ?? []}
            />
          );
        if (field.type === "textarea")
          return (
            <TextareaField
              key={field.name}
              {...shared}
              className="sm:col-span-2"
            />
          );
        if (field.type === "time")
          return (
            <TimePickerField
              key={field.name}
              {...shared}
              minTime={field.minTime}
              maxTime={field.maxTime}
            />
          );
        return (
          <InputField
            key={field.name}
            {...shared}
            type={
              field.type === "email" || field.type === "number"
                ? field.type
                : "text"
            }
            maxLength={field.max}
          />
        );
      })}
    </div>
  );
}

function fieldPlaceholder(field: RecruitmentField): string {
  if (field.readonly) return "";
  if (field.placeholder) return field.placeholder;
  switch (field.type) {
    case "date":
      return "DD/MM/YYYY";
    case "time":
      return "HH:mm";
    case "select":
    case "multi":
      return `Chọn ${field.label.toLowerCase()}`;
    default:
      return `Nhập ${field.label.toLowerCase()}...`;
  }
}
