import { t, useLocale } from "@/i18n";
import { useState } from "react";
import { ChevronDown, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  useLocale();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-muted has-disabled:cursor-not-allowed has-disabled:opacity-60",
        checked ? "border-primary/30 bg-primary/10" : "border-border bg-card",
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
      <span className="min-w-0 leading-5">{label}</span>
    </label>
  );
}
const fieldTypes = [
  {
    value: "text",
    get label() {
      return t("settings-templates", "Văn bản");
    },
  },
  {
    value: "number",
    get label() {
      return t("settings-templates", "Số");
    },
  },
  {
    value: "date-text",
    get label() {
      return t("settings-templates", "Ngày");
    },
  },
  {
    value: "range-date-text",
    get label() {
      return t("settings-templates", "Khoảng ngày");
    },
  },
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
  useLocale();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const rule =
    typeof field.validate === "object" && field.validate !== null
      ? field.validate
      : {};
  const dateFields = groups
    .flatMap((group) => group.children)
    .filter((other) => other !== field && other.type.includes("date"));
  const typeOptions = fieldTypes.some((option) => option.value === field.type)
    ? fieldTypes
    : [...fieldTypes, { value: field.type, label: field.type }];
  const canCompareDates = field.type.includes("date") && dateFields.length > 0;
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
      <FormFieldShell
        id={`${id}-title`}
        label={t("settings-templates", "Tên trường")}
        required
      >
        <Input
          id={`${id}-title`}
          value={field.title}
          disabled={disabled}
          placeholder={t("settings-templates", "Nhập tên trường")}
          onChange={(event) =>
            onChange({ ...field, title: event.target.value })
          }
        />
      </FormFieldShell>
      <FormFieldShell
        id={`${id}-type`}
        label={t("settings-templates", "Kiểu dữ liệu")}
      >
        <SearchableSelect
          id={`${id}-type`}
          label={t("settings-templates", "Kiểu dữ liệu")}
          value={field.type}
          options={typeOptions}
          disabled={disabled}
          onValueChange={(type) => onChange({ ...field, type })}
        />
      </FormFieldShell>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        {(
          [
            { key: "required", label: t("settings-templates", "Bắt buộc") },
            {
              key: "handling",
              label: t("settings-templates", "Cho phép thay đổi"),
            },
            {
              key: "status",
              label: t(
                "settings-templates",
                "Chỉ hiển thị cho người tạo và người xử lý",
              ),
            },
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
      <details
        className="group rounded-lg border border-border sm:col-span-2"
        open={advancedOpen}
        onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <Settings2
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />{" "}
          {t("settings-templates", "Tùy chọn nâng cao")}{" "}
          <ChevronDown
            className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div
          className={cn(
            "grid grid-cols-1 items-start gap-3 border-t border-border p-3 sm:grid-cols-2",
            canCompareDates && "xl:grid-cols-3",
          )}
        >
          <FormFieldShell
            id={`${id}-options`}
            label={t("settings-templates", "Tùy chọn (mỗi dòng một giá trị)")}
            className={canCompareDates ? "xl:row-span-2" : undefined}
          >
            <Textarea
              id={`${id}-options`}
              value={(field.option ?? [])
                .map((value) => (Array.isArray(value) ? value[1] : value))
                .join("\n")}
              rows={3}
              disabled={disabled}
              placeholder={t("settings-templates", "Nhập các lựa chọn")}
              onChange={(event) =>
                onChange({ ...field, option: event.target.value.split("\n") })
              }
            />
          </FormFieldShell>
          <FormFieldShell
            id={`${id}-width`}
            label={t("settings-templates", "Độ rộng cột (px)")}
          >
            <Input
              id={`${id}-width`}
              type="number"
              min={1}
              value={field.widthcol ?? ""}
              disabled={disabled}
              placeholder={t("settings-templates", "Tự động")}
              onChange={(event) => {
                const next = { ...field };
                if (event.target.value) next.widthcol = event.target.value;
                else delete next.widthcol;
                onChange(next);
              }}
            />
          </FormFieldShell>
          {canCompareDates && (
            <>
              <FormFieldShell
                id={`${id}-operator`}
                label={t("settings-templates", "Điều kiện ngày")}
              >
                <SearchableSelect
                  id={`${id}-operator`}
                  label={t("settings-templates", "Điều kiện ngày")}
                  placeholder={t("settings-templates", "Không áp dụng")}
                  value={typeof rule.operator === "string" ? rule.operator : ""}
                  disabled={disabled}
                  options={[
                    {
                      value: "",
                      label: t("settings-templates", "Không áp dụng"),
                    },
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
              <FormFieldShell
                id={`${id}-target`}
                label={t("settings-templates", "So sánh với trường")}
                className="xl:col-span-2"
              >
                <SearchableSelect
                  id={`${id}-target`}
                  label={t("settings-templates", "So sánh với trường")}
                  value={typeof rule.target === "string" ? rule.target : ""}
                  disabled={disabled || !rule.operator}
                  placeholder={t("settings-templates", "Chọn trường ngày")}
                  options={dateFields
                    .filter((other) => other.title.trim())
                    .map((other) => ({
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
      </details>
    </div>
  );
}
