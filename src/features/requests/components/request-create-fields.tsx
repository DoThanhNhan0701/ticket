import { t, useLocale } from "@/i18n";
import type { UseFormReturn } from "react-hook-form";
import { startOfToday } from "date-fns";
import { SelectField } from "@/components/form/select-field";
import { MultiSelectField } from "@/components/form/multi-select-field";
import { DatePickerField } from "@/components/form/date-picker-field";
import { TextareaField } from "@/components/form/textarea-field";
import { InputField } from "@/components/form/input-field";
import type { CreateRequestLookups } from "../api/create-request-api";
import type { CreateRequestValues } from "../schemas/create-request-schema";
import type { RequestType } from "../types";

const options = (rows: readonly { id: number; name?: string }[]) =>
  rows.map((row) => ({
    value: String(row.id),
    label: row.name || String(row.id),
  }));
interface FieldsProps {
  form: UseFormReturn<CreateRequestValues>;
  lookups?: CreateRequestLookups;
  disabled: boolean;
}
export function RequestAssignmentFields({
  form,
  lookups,
  disabled,
  types,
  typesLoading,
}: Readonly<
  FieldsProps & { types: readonly RequestType[]; typesLoading: boolean }
>) {
  useLocale();
  const fields = [
    {
      name: "handling_group",
      label: t("request-create", "Bộ phận xử lý"),
      options: options(lookups?.groups ?? []),
    },
    {
      name: "ticket_type",
      label: t("request-create", "Loại yêu cầu"),
      options: options(types),
      loading: typesLoading,
      disabled: !types.length,
    },
    {
      name: "approve_user",
      label: t("request-create", "Người phê duyệt"),
      options: (lookups?.approvers ?? []).map((row) => ({
        value: String(row.id),
        label:
          [row.last_name, row.first_name].filter(Boolean).join(" ") ||
          row.username,
      })),
    },
    {
      name: "fore_cus",
      label: t("request-create", "Công ty"),
      options: options(lookups?.customers ?? []),
    },
  ] as const;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {fields.map((field) => (
        <SelectField
          key={field.name}
          control={form.control}
          name={field.name}
          id={`create-${field.name}`}
          label={field.label}
          placeholder={t("request-create", "Chọn {0}", [
            field.label.toLowerCase(),
          ])}
          required
          searchable
          options={field.options}
          isLoading={"loading" in field && field.loading}
          disabled={disabled || ("disabled" in field && field.disabled)}
          noDataText={t("request-create", "Không có dữ liệu để chọn")}
        />
      ))}
    </div>
  );
}
export function RequestGeneralFields({
  form,
  lookups,
  disabled,
}: Readonly<FieldsProps>) {
  useLocale();
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <InputField
        control={form.control}
        name="title"
        id="create-title"
        label={t("request-create", "Tiêu đề yêu cầu")}
        placeholder={t("request-create", "Bạn cần hỗ trợ việc gì?")}
        maxLength={300}
        required
        disabled={disabled}
        className="sm:col-span-2 xl:col-span-4"
      />
      <SelectField
        control={form.control}
        name="bophansudung"
        id="create-department"
        label={t("request-create", "Department")}
        placeholder={t("request-create", "Chọn Department")}
        required
        searchable
        options={options(lookups?.departments ?? [])}
        disabled={disabled}
      />
      <MultiSelectField
        control={form.control}
        name="other1"
        id="create-teams"
        label={t("request-create", "Team sử dụng")}
        placeholder={t("request-create", "Chọn Team")}
        options={options(lookups?.teams ?? [])}
        disabled={disabled}
        maxBadgeCount={3}
      />
      <SelectField
        control={form.control}
        name="vanphong"
        id="create-office"
        label={t("request-create", "Văn phòng")}
        placeholder={t("request-create", "Chọn văn phòng")}
        required
        searchable
        options={options(lookups?.offices ?? [])}
        disabled={disabled}
      />
      <DatePickerField
        control={form.control}
        name="duedate"
        id="create-due-date"
        label={t("request-create", "Ngày mong muốn")}
        required
        isDateDisabled={(date) => date < startOfToday()}
        disabledDateMessage={t(
          "request-create",
          "Ngày mong muốn không được trước hôm nay.",
        )}
        endYear={new Date().getFullYear() + 10}
        disabled={disabled}
      />
    </div>
  );
}

export function RequestNotesField({
  form,
  disabled,
}: Readonly<Pick<FieldsProps, "form" | "disabled">>) {
  useLocale();
  return (
    <TextareaField
      control={form.control}
      name="description"
      id="create-description"
      label={t("request-create", "Ghi chú")}
      placeholder={t(
        "request-create",
        "Thông tin bổ sung cho người xử lý (tối đa 1000 ký tự)",
      )}
      disabled={disabled}
    />
  );
}
