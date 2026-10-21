import { useEffect, useState, type ReactNode } from "react";
import {
  useForm,
  useWatch,
  type Control,
  type ResolverResult,
} from "react-hook-form";
import { InputField } from "@/components/form/input-field";
import { DatePickerField } from "@/components/form/date-picker-field";
import { SelectField } from "@/components/form/select-field";
import { MultiSelectField } from "@/components/form/multi-select-field";
import { RecruitmentAdvancedDrawer } from "./recruitment-advanced-drawer";
import { RecruitmentFilterActions } from "./recruitment-filter-actions";
import type { RecruitmentLookups } from "../types";
import {
  defaultRecruitmentDates,
  recruitmentDate,
} from "../utils/recruitment-format";
import { validateRecruitmentRange } from "../utils/recruitment-validation";
export function RecruitmentFilters({
  values,
  lookups,
  mode,
  busy,
  onApply,
  onReset,
  actions,
}: Readonly<{
  values: Record<string, string>;
  lookups: RecruitmentLookups;
  mode: "requests" | "candidates" | "interviews" | "reports";
  busy: boolean;
  onApply: (values: Record<string, string>) => void;
  onReset: () => void;
  actions?: ReactNode;
}>) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const hasAdvanced = mode === "requests" || mode === "candidates";
  const form = useForm<Record<string, string>>({
    values,
    resolver: (input): ResolverResult<Record<string, string>> => {
      const maxMonths = mode === "reports" ? 6 : undefined;
      const issue =
        mode === "interviews"
          ? validateCalendarDate(input.from_date)
          : validateRecruitmentRange(input.from_date, input.to_date, maxMonths);
      return issue
        ? {
            values: {},
            errors: { from_date: { type: "validate", message: issue } },
          }
        : { values: input, errors: {} };
    },
  });
  const [from, to] = useWatch({
    control: form.control,
    name: ["from_date", "to_date"],
  });
  const {
    trigger,
    formState: { isSubmitted },
  } = form;
  useEffect(() => {
    if (isSubmitted) void trigger("from_date");
  }, [from, to, isSubmitted, trigger]);
  const activeCount = advancedFilterCount(mode, values);
  const shared = { control: form.control, disabled: busy };
  const apply = (input: Record<string, string>) => {
    if (busy) return;
    onApply({
      ...input,
      from_date: recruitmentDate(input.from_date),
      to_date: recruitmentDate(input.to_date),
    });
    setAdvancedOpen(false);
  };
  const submit = form.handleSubmit(apply, () => {
    if (hasAdvanced) setAdvancedOpen(true);
  });
  return (
    <form
      aria-label="Bộ lọc tuyển dụng"
      noValidate
      className="space-y-3 rounded-xl border bg-card p-3"
      onSubmit={submit}
    >
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap [&>[data-slot=field]]:xl:w-60 [&>[data-slot=field]]:xl:flex-none">
        {["requests", "candidates"].includes(mode) && (
          <InputField
            {...shared}
            name={mode === "requests" ? "title" : "search"}
            id="recruitment-filter-search"
            label={mode === "requests" ? "Tiêu đề" : "Tìm kiếm"}
            placeholder="Nhập từ khóa..."
          />
        )}
        {mode === "requests" && (
          <SelectField
            {...shared}
            name="ticket_status"
            searchable
            id="recruitment-filter-status"
            label="Trạng thái yêu cầu"
            placeholder="Tất cả trạng thái"
            options={[
              { value: "", label: "Tất cả trạng thái" },
              ...[
                [2, "Đã phê duyệt"],
                [3, "Đang xử lý"],
                [4, "Hoàn thành"],
                [6, "Xử lý lại"],
                [7, "Hủy"],
              ].map(([value, label]) => ({
                value: String(value),
                label: String(label),
              })),
            ]}
          />
        )}
        {mode === "candidates" && (
          <SelectField
            {...shared}
            name="cv_status"
            id="recruitment-filter-status"
            label="Trạng thái CV"
            placeholder="Tất cả trạng thái"
            searchable
            options={[
              { value: "", label: "Tất cả trạng thái" },
              ...(lookups.statuses ?? []),
            ]}
          />
        )}
        {mode === "interviews" && (
          <DatePickerField
            {...shared}
            name="from_date"
            id="recruitment-filter-from"
            label="Ngày xem lịch"
            required
            endYear={new Date().getFullYear() + 5}
          />
        )}
        {mode === "interviews" && (
          <InputField
            {...shared}
            name="user_interview"
            id="recruitment-filter-interviewer"
            label="Người phỏng vấn"
            placeholder="Nhập tên đăng nhập..."
          />
        )}
        {mode === "reports" && <RecruitmentDateRange {...shared} />}
        <RecruitmentFilterActions
          busy={busy}
          onReset={() => {
            form.reset(values);
            onReset();
          }}
        >
          {hasAdvanced && (
            <RecruitmentAdvancedDrawer
              open={advancedOpen}
              disabled={busy}
              activeCount={activeCount}
              onOpenChange={(open) => {
                if (!open) {
                  for (const key of advancedKeys(mode))
                    form.setValue(key, values[key] ?? "");
                  form.clearErrors();
                }
                setAdvancedOpen(open);
              }}
              onApply={submit}
              onClear={() => {
                const next = {
                  ...form.getValues(),
                  ...Object.fromEntries(
                    advancedKeys(mode).map((key) => [
                      key,
                      (defaultRecruitmentDates() as Record<string, string>)[
                        key
                      ] ?? "",
                    ]),
                  ),
                };
                form.reset(next);
                apply(next);
              }}
            >
              {mode !== "interviews" && <RecruitmentDateRange {...shared} />}
              {["requests", "candidates"].includes(mode) && (
                <MultiSelectField
                  {...shared}
                  name="department_recruited"
                  id="recruitment-filter-department"
                  label="Bộ phận tuyển dụng"
                  placeholder="Chọn bộ phận"
                  options={lookups.departments ?? []}
                  valueFormat="csv"
                />
              )}
              {mode === "candidates" && (
                <>
                  <InputField
                    {...shared}
                    name="ticket_code"
                    id="recruitment-filter-ticket"
                    label="Mã yêu cầu tuyển dụng"
                  />
                </>
              )}

              {["requests", "candidates"].includes(mode) && (
                <SelectField
                  {...shared}
                  name="user_received"
                  id="recruitment-filter-user"
                  placeholder="Tất cả người dùng"
                  label="Người phụ trách"
                  searchable
                  options={[
                    { value: "", label: "Tất cả người dùng" },
                    ...(lookups.users ?? []),
                  ]}
                />
              )}
            </RecruitmentAdvancedDrawer>
          )}
          {actions && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {actions}
            </div>
          )}
        </RecruitmentFilterActions>
      </div>
    </form>
  );
}

function validateCalendarDate(value: string) {
  return recruitmentDate(value) ? null : "Ngày không hợp lệ.";
}

function RecruitmentDateRange({
  control,
  disabled,
}: Readonly<{ control: Control<Record<string, string>>; disabled: boolean }>) {
  return (
    <>
      {[
        ["from_date", "from", "Từ ngày"],
        ["to_date", "to", "Đến ngày"],
      ].map(([name, id, label]) => (
        <DatePickerField
          key={name}
          control={control}
          disabled={disabled}
          name={name}
          id={`recruitment-filter-${id}`}
          label={label}
          required
          endYear={new Date().getFullYear() + 5}
        />
      ))}
    </>
  );
}

function advancedFilterCount(
  mode: string,
  draft: Record<string, string | undefined>,
) {
  const defaults: Record<string, string> = defaultRecruitmentDates();
  return advancedKeys(mode).filter((key) => {
    const raw = draft[key]?.trim() ?? "";
    const value = key.endsWith("_date") ? recruitmentDate(raw) : raw;
    return Boolean(value) && value !== (defaults[key] ?? "");
  }).length;
}

function advancedKeys(mode: string) {
  return mode === "interviews"
    ? []
    : [
        "from_date",
        "to_date",
        "department_recruited",
        "user_received",
        "ticket_code",
      ];
}
