import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { FormFieldShell } from "@/components/form/form-field-shell";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { TemplateField, TemplateGroup } from "../schemas/template-schema";

export function TemplateCheckbox({
  id,
  label,
  checked,
  disabled,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}>) {
  return (
    <label htmlFor={id} className="flex min-h-10 items-center gap-2 text-sm">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
      {label}
    </label>
  );
}
const fieldTypes = [
  { value: "text", label: "Văn bản" },
  { value: "number", label: "Số" },
  { value: "date-text", label: "Ngày" },
  { value: "range-date-text", label: "Khoảng ngày" },
];

export function TemplateFieldControls({
  field,
  id,
  disabled,
  groups,
  onChange,
}: Readonly<{
  field: TemplateField;
  id: string;
  disabled: boolean;
  groups: readonly TemplateGroup[];
  onChange: (field: TemplateField) => void;
}>) {
  const rule =
    typeof field.validate === "object" && field.validate !== null
      ? field.validate
      : {};
  const dateFields = groups
    .flatMap((group) => group.children)
    .filter(
      (other) =>
        other !== field && other.type.includes("date") && other.title.trim(),
    );
  const typeOptions = fieldTypes.some((option) => option.value === field.type)
    ? fieldTypes
    : [...fieldTypes, { value: field.type, label: field.type }];
  return (
    <div className="grid min-w-0 items-start gap-3 sm:grid-cols-2">
      <FormFieldShell id={`${id}-title`} label="Tên trường" required>
        <Input
          id={`${id}-title`}
          value={field.title}
          disabled={disabled}
          placeholder="Nhập tên trường"
          onChange={(event) =>
            onChange({ ...field, title: event.target.value })
          }
        />
      </FormFieldShell>
      <FormFieldShell id={`${id}-type`} label="Kiểu dữ liệu">
        <SearchableSelect
          id={`${id}-type`}
          label="Kiểu dữ liệu"
          value={field.type}
          options={typeOptions}
          disabled={disabled}
          onValueChange={(type) => onChange({ ...field, type })}
        />
      </FormFieldShell>
      <FormFieldShell
        id={`${id}-options`}
        label="Tùy chọn (mỗi dòng một giá trị)"
      >
        <Textarea
          id={`${id}-options`}
          value={(field.option ?? [])
            .map((value) => (Array.isArray(value) ? value[1] : value))
            .join("\n")}
          rows={2}
          disabled={disabled}
          placeholder="Nhập các lựa chọn"
          onChange={(event) =>
            onChange({ ...field, option: event.target.value.split("\n") })
          }
        />
      </FormFieldShell>
      <FormFieldShell id={`${id}-width`} label="Độ rộng cột (px)">
        <Input
          id={`${id}-width`}
          type="number"
          min={1}
          value={field.widthcol ?? ""}
          disabled={disabled}
          placeholder="Tự động"
          onChange={(event) => {
            const next = { ...field };
            if (event.target.value) next.widthcol = event.target.value;
            else delete next.widthcol;
            onChange(next);
          }}
        />
      </FormFieldShell>
      <div className="flex flex-wrap gap-x-4 sm:col-span-2">
        {(
          [
            { key: "required", label: "Bắt buộc" },
            { key: "handling", label: "Cho phép thay đổi" },
            { key: "status", label: "Chỉ người tạo và người xử lý" },
          ] as const
        ).map((option) => (
          <TemplateCheckbox
            key={option.key}
            id={`${id}-${option.key}`}
            label={option.label}
            checked={field[option.key] === true}
            disabled={disabled}
            onChange={(value) => onChange({ ...field, [option.key]: value })}
          />
        ))}
      </div>
      {field.type.includes("date") && (
        <>
          <FormFieldShell id={`${id}-operator`} label="Điều kiện ngày">
            <SearchableSelect
              id={`${id}-operator`}
              label="Điều kiện ngày"
              value={typeof rule.operator === "string" ? rule.operator : ""}
              disabled={disabled}
              options={[
                { value: "", label: "Không áp dụng" },
                ...[">", ">=", "<", "<="].map((value) => ({
                  value,
                  label: value,
                })),
              ]}
              onValueChange={(operator) =>
                onChange({
                  ...field,
                  validate: operator ? { ...rule, operator } : null,
                })
              }
            />
          </FormFieldShell>
          <FormFieldShell id={`${id}-target`} label="So sánh với trường">
            <SearchableSelect
              id={`${id}-target`}
              label="So sánh với trường"
              value={typeof rule.target === "string" ? rule.target : ""}
              disabled={disabled || !rule.operator}
              placeholder="Chọn trường ngày"
              options={dateFields.map((other) => ({
                value: other.title,
                label: other.title,
              }))}
              onValueChange={(target) =>
                onChange({ ...field, validate: { ...rule, target } })
              }
            />
          </FormFieldShell>
        </>
      )}
    </div>
  );
}
