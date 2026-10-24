import { t, useLocale } from "@/i18n";
import { addDays, addMonths, addWeeks, format } from "date-fns";
import { useController, useWatch, type Control } from "react-hook-form";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/form/input-field";
import { SelectField } from "@/components/form/select-field";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  interviewCalendarView,
  recruitmentDate,
} from "../utils/recruitment-format";

export function InterviewCalendarFilters(
  props: Readonly<{
    control: Control<Record<string, string>>;
    disabled: boolean;
  }>,
) {
  useLocale();
  const mobile = useIsMobile();
  return (
    <>
      <InputField
        {...props}
        name="user_interview"
        id="recruitment-filter-interviewer"
        label={t("interviews", "Người phỏng vấn")}
        placeholder={t("interviews", "Nhập tên đăng nhập...")}
      />
      {mobile && <MobileCalendarNavigation {...props} />}
    </>
  );
}

function MobileCalendarNavigation({
  control,
  disabled,
}: Readonly<{
  control: Control<Record<string, string>>;
  disabled: boolean;
}>) {
  useLocale();
  const { field: date } = useController({ control, name: "from_date" });
  const view = useWatch({
    control,
    name: "calendar_view",
    defaultValue: "week",
  });
  const shift = (amount: number) => {
    const normalized = recruitmentDate(date.value);
    if (!normalized) return;
    const current = new Date(`${normalized}T12:00:00`);
    const shifts = { month: addMonths, week: addWeeks, day: addDays };
    date.onChange(
      format(
        shifts[interviewCalendarView(view)](current, amount),
        "dd/MM/yyyy",
      ),
    );
  };
  return (
    <>
      <SelectField
        control={control}
        disabled={disabled}
        name="calendar_view"
        id="recruitment-calendar-view"
        label={t("interviews", "Chế độ xem lịch")}
        options={[
          { value: "month", label: t("interviews", "Tháng") },
          { value: "week", label: t("interviews", "Tuần") },
          { value: "day", label: t("interviews", "Ngày") },
        ]}
      />
      <div className="col-span-full grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label={t("interviews", "Khoảng trước")}
          title={t("interviews", "Khoảng trước")}
          className="size-11"
          onClick={() => shift(-1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => date.onChange(format(new Date(), "dd/MM/yyyy"))}
        >
          {t("interviews", "Hôm nay")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label={t("interviews", "Khoảng sau")}
          title={t("interviews", "Khoảng sau")}
          className="size-11"
          onClick={() => shift(1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </>
  );
}
