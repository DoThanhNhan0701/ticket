import { t, useLocale } from "@/i18n";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputField } from "@/components/form/input-field";
import { SelectField } from "@/components/form/select-field";
import type { RecruitmentOption } from "../types";
import { ResponsiveFilters } from "@/components/data-management/responsive-filters";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { RecruitmentAdvancedDrawer } from "./recruitment-advanced-drawer";
import { RecruitmentFilterActions } from "./recruitment-filter-actions";
import { interviewCandidateFilterSchema } from "../utils/recruitment-validation";

export interface InterviewCandidateFilterValues {
  search: string;
  gender: string;
  cv_status: string;
}
const emptyInterviewFilters: InterviewCandidateFilterValues = {
  search: "",
  gender: "",
  cv_status: "",
};

export function InterviewCandidateFilters({
  values,
  statuses,
  busy,
  onApply,
}: Readonly<{
  values: InterviewCandidateFilterValues;
  statuses: RecruitmentOption[];
  busy: boolean;
  onApply: (values: InterviewCandidateFilterValues) => void;
}>) {
  useLocale();
  const mobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const form = useForm<InterviewCandidateFilterValues>({
    values,
    resolver: zodResolver(interviewCandidateFilterSchema({ statuses })),
  });
  const shared = { control: form.control, disabled: busy };
  const apply = (input: InterviewCandidateFilterValues) => {
    if (busy) return;
    onApply({ ...input, search: input.search.trim() });
    setAdvancedOpen(false);
    setMobileOpen(false);
  };
  const submit = form.handleSubmit(apply, (errors) => {
    if (errors.gender) setAdvancedOpen(true);
  });
  const genderField = (
    <SelectField
      {...shared}
      id="interview-filter-gender"
      name="gender"
      searchable
      label={t("interviews", "Giới tính ứng viên")}
      placeholder={t("interviews", "Tất cả giới tính")}
      options={[
        { value: "", label: t("interviews", "Tất cả giới tính") },
        {
          value: "Nam",
          get label() {
            return t("common", "Nam");
          },
        },
        { value: "Nữ", label: t("interviews", "Nữ") },
      ]}
    />
  );
  return (
    <ResponsiveFilters
      mobile={mobile}
      open={mobileOpen}
      onOpenChange={(open) => {
        if (!open) {
          form.reset(values);
          form.clearErrors();
        }
        setMobileOpen(open);
      }}
      activeCount={Object.values(values).filter((value) => value.trim()).length}
    >
      <form
        aria-label={t("interviews", "Bộ lọc CV phỏng vấn")}
        noValidate
        className="space-y-3 rounded-xl border bg-card p-3"
        onSubmit={submit}
      >
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap [&>[data-slot=field]]:xl:w-60 [&>[data-slot=field]]:xl:flex-none">
          <InputField
            {...shared}
            id="interview-filter-search"
            name="search"
            label={t("interviews", "Tìm ứng viên phỏng vấn")}
            placeholder={t("interviews", "Tìm tên, email, số điện thoại...")}
          />
          <SelectField
            {...shared}
            id="interview-filter-status"
            name="cv_status"
            label={t("interviews", "Trạng thái ứng viên")}
            placeholder={t("interviews", "Tất cả trạng thái")}
            searchable
            options={[
              { value: "", label: t("interviews", "Tất cả trạng thái") },
              ...statuses,
            ]}
          />
          {mobile && genderField}
          <RecruitmentFilterActions
            onCancel={
              mobile
                ? () => {
                    form.reset(values);
                    form.clearErrors();
                    setMobileOpen(false);
                  }
                : undefined
            }
            busy={busy}
            onReset={() => {
              form.reset(emptyInterviewFilters);
              onApply(emptyInterviewFilters);
              setMobileOpen(false);
            }}
          >
            {!mobile && (
              <RecruitmentAdvancedDrawer
                open={advancedOpen}
                disabled={busy}
                activeCount={values.gender ? 1 : 0}
                onOpenChange={(open) => {
                  if (!open) {
                    form.setValue("gender", values.gender);
                    form.clearErrors("gender");
                  }
                  setAdvancedOpen(open);
                }}
                onApply={submit}
                onClear={() => {
                  const next = { ...form.getValues(), gender: "" };
                  form.reset(next);
                  void form.handleSubmit(apply)();
                }}
              >
                {genderField}
              </RecruitmentAdvancedDrawer>
            )}
          </RecruitmentFilterActions>
        </div>
      </form>
    </ResponsiveFilters>
  );
}
