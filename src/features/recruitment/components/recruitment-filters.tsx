import { useEffect, useState, type ReactNode } from "react";
import { useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputField } from "@/components/form/input-field";
import { DatePickerField } from "@/components/form/date-picker-field";
import { SelectField } from "@/components/form/select-field";
import { MultiSelectField } from "@/components/form/multi-select-field";
import { ResponsiveFilters } from "@/components/data-management/responsive-filters";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { InterviewCalendarFilters } from "./interview-calendar-filters";
import { RecruitmentAdvancedDrawer } from "./recruitment-advanced-drawer";
import { RecruitmentFilterActions } from "./recruitment-filter-actions";
import type { RecruitmentLookups } from "../types";
import {
  defaultRecruitmentDates,
  recruitmentDate,
} from "../utils/recruitment-format";
import { recruitmentFilterSchema } from "../utils/recruitment-validation";
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
  const mobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const hasAdvanced = mode === "requests" || mode === "candidates";
  const form = useForm<Record<string, string>>({
    values: filterValues(mode, values),
    resolver: zodResolver(recruitmentFilterSchema(mode, lookups)),
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
    if (isSubmitted) void trigger(["from_date", "to_date"]);
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
    setMobileOpen(false);
  };
  const submit = form.handleSubmit(apply, () => {
    if (hasAdvanced) setAdvancedOpen(true);
  });
  const advancedFields = (
    <RecruitmentAdvancedFields mode={mode} lookups={lookups} {...shared} />
  );
  return (
    <ResponsiveFilters
      actionsInHeader
      mobile={mobile}
      open={mobileOpen}
      onOpenChange={(open) => {
        if (!open) {
          form.reset(filterValues(mode, values));
          form.clearErrors();
        }
        setMobileOpen(open);
      }}
      activeCount={mobileFilterCount(mode, values)}
      actions={actions}
    >
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
              placeholder={
                mode === "requests"
                  ? "Nhập tiêu đề yêu cầu..."
                  : "Nhập tên, email, số điện thoại..."
              }
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
          {mode === "interviews" && <InterviewCalendarFilters {...shared} />}
          {mode === "reports" && <RecruitmentDateRange {...shared} />}
          {mobile && hasAdvanced && advancedFields}
          <RecruitmentFilterActions
            onCancel={
              mobile
                ? () => {
                    form.reset(filterValues(mode, values));
                    form.clearErrors();
                    setMobileOpen(false);
                  }
                : undefined
            }
            busy={busy}
            onReset={() => {
              form.reset(filterValues(mode, values));
              onReset();
              setMobileOpen(false);
            }}
          >
            {!mobile && hasAdvanced && (
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
                  void form.handleSubmit(apply)();
                }}
              >
                {advancedFields}
              </RecruitmentAdvancedDrawer>
            )}
            {!mobile && actions && (
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {actions}
              </div>
            )}
          </RecruitmentFilterActions>
        </div>
      </form>
    </ResponsiveFilters>
  );
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

function filterValues(mode: string, values: Record<string, string>) {
  const fields: Record<string, string[]> = {
    requests: [...advancedKeys(mode), "title", "ticket_status"],
    candidates: [...advancedKeys(mode), "search", "cv_status"],
    interviews: ["from_date", "user_interview", "calendar_view"],
    reports: ["from_date", "to_date"],
  };
  return {
    ...Object.fromEntries(
      fields[mode].map((key) => [key, key === "calendar_view" ? "week" : ""]),
    ),
    ...values,
  };
}

function mobileFilterCount(mode: string, values: Record<string, string>) {
  const primary: Record<string, string[]> = {
    requests: ["title", "ticket_status"],
    candidates: ["search", "cv_status"],
    interviews: ["from_date", "user_interview"],
    reports: ["from_date", "to_date"],
  };
  const defaults: Record<string, string> = defaultRecruitmentDates();
  if (mode === "interviews") defaults.from_date = defaults.to_date;
  return [...new Set([...advancedKeys(mode), ...primary[mode]])].filter(
    (key) => {
      const value = values[key]?.trim();
      return (
        value &&
        (key.endsWith("_date") ? recruitmentDate(value) : value) !==
          (defaults[key] ?? "")
      );
    },
  ).length;
}

function RecruitmentAdvancedFields({
  mode,
  lookups,
  control,
  disabled,
}: Readonly<{
  mode: string;
  lookups: RecruitmentLookups;
  control: Control<Record<string, string>>;
  disabled: boolean;
}>) {
  const shared = { control, disabled };
  return (
    <>
      <RecruitmentDateRange {...shared} />
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
            placeholder="Nhập mã yêu cầu tuyển dụng..."
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
    </>
  );
}
