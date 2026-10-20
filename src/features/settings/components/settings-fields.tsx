import { useWatch, type UseFormReturn } from "react-hook-form";
import { InputField } from "@/components/form/input-field";
import { SelectField } from "@/components/form/select-field";
import { MultiSelectField } from "@/components/form/multi-select-field";
import { TextareaField } from "@/components/form/textarea-field";
import type {
  SettingsField,
  SettingsFormValues,
  SettingsLookups,
} from "../types";
import { settingsOptions } from "../utils/settings-form";

export function SettingsFieldControl({
  field,
  form,
  lookups,
  disabled,
  editing,
}: Readonly<{
  field: SettingsField;
  form: UseFormReturn<SettingsFormValues>;
  lookups: SettingsLookups;
  disabled: boolean;
  editing: boolean;
}>) {
  const value = useWatch({ control: form.control, name: field.name });
  const shared = {
    control: form.control,
    id: `settings-${field.name}`,
    name: field.name,
    label: field.label,
    required: field.required,
    disabled,
  };
  if (
    field.type === "multi" &&
    (field.name === "ls_member" || field.name === "permission")
  )
    return (
      <MultiSelectField
        {...shared}
        options={settingsOptions(lookups[field.lookup!] ?? [], value)}
        placeholder={`Chọn ${field.label.toLowerCase()}`}
        noDataText="Không có dữ liệu"
        maxBadgeCount={3}
      />
    );
  if (field.type === "select")
    return (
      <SelectField
        {...shared}
        searchable
        options={[
          ...(!field.required ? [{ value: "", label: "Không chọn" }] : []),
          ...settingsOptions(lookups[field.lookup!] ?? [], value),
        ]}
        placeholder={`Chọn ${field.label.toLowerCase()}`}
        noDataText="Không có dữ liệu"
      />
    );
  if (field.type === "textarea")
    return (
      <TextareaField
        {...shared}
        placeholder={`Nhập ${field.label.toLowerCase()}`}
        className="sm:col-span-2"
      />
    );
  return (
    <InputField
      {...shared}
      type={field.type === "email" ? "email" : "text"}
      maxLength={field.maxLength}
      disabled={disabled || (editing && field.createOnly)}
      required={field.required && !(editing && field.createOnly)}
      placeholder={`Nhập ${field.label.toLowerCase()}`}
    />
  );
}
