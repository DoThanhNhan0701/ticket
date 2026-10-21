import { useState } from "react";
import { useForm } from "react-hook-form";
import { InputField } from "@/components/form/input-field";
import { SelectField } from "@/components/form/select-field";
import type { RecruitmentOption } from "../types";
import { RecruitmentAdvancedDrawer } from "./recruitment-advanced-drawer";
import { RecruitmentFilterActions } from "./recruitment-filter-actions";

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const form = useForm<InterviewCandidateFilterValues>({ values });
  const shared = { control: form.control, disabled: busy };
  const apply = (input: InterviewCandidateFilterValues) => {
    if (busy) return;
    onApply({ ...input, search: input.search.trim() });
    setAdvancedOpen(false);
  };
  const submit = form.handleSubmit(apply);
  return (
    <form
      aria-label="Bộ lọc CV phỏng vấn"
      className="space-y-3 rounded-xl border bg-card p-3"
      onSubmit={submit}
    >
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap [&>[data-slot=field]]:xl:w-60 [&>[data-slot=field]]:xl:flex-none">
        <InputField
          {...shared}
          id="interview-filter-search"
          name="search"
          label="Tìm ứng viên phỏng vấn"
          placeholder="Tìm tên, email, số điện thoại..."
        />
        <SelectField
          {...shared}
          id="interview-filter-status"
          name="cv_status"
          label="Trạng thái ứng viên"
          placeholder="Tất cả trạng thái"
          searchable
          options={[{ value: "", label: "Tất cả trạng thái" }, ...statuses]}
        />
        <RecruitmentFilterActions
          busy={busy}
          onReset={() => {
            form.reset(emptyInterviewFilters);
            onApply(emptyInterviewFilters);
          }}
        >
          <RecruitmentAdvancedDrawer
            open={advancedOpen}
            disabled={busy}
            activeCount={values.gender ? 1 : 0}
            onOpenChange={(open) => {
              if (!open) form.setValue("gender", values.gender);
              setAdvancedOpen(open);
            }}
            onApply={submit}
            onClear={() => {
              const next = { ...form.getValues(), gender: "" };
              form.reset(next);
              apply(next);
            }}
          >
            <SelectField
              {...shared}
              id="interview-filter-gender"
              name="gender"
              searchable
              label="Giới tính ứng viên"
              placeholder="Tất cả giới tính"
              options={[
                { value: "", label: "Tất cả giới tính" },
                { value: "Nam", label: "Nam" },
                { value: "Nữ", label: "Nữ" },
              ]}
            />
          </RecruitmentAdvancedDrawer>
        </RecruitmentFilterActions>
      </div>
    </form>
  );
}
