import { t, useLocale } from "@/i18n";
import { useInterviewCalendarState } from "../hooks/use-interview-calendar-state";
import { ErrorToast } from "@/components/error-toast";
import { PAGE_LINKS } from "@/constants/routes";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { ResponsivePageAction } from "@/components/layout/mobile-page-action";
import { useState } from "react";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CalendarPlus,
  CalendarDays,
  CalendarRange,
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/loading-state";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import type { RecruitmentEditorState } from "../types";
import { listRecruitment, recruitmentObject } from "../api/recruitment-api";
import { useRecruitmentLookups } from "../hooks/use-recruitment-lookups";
import { InterviewCalendarGrid } from "./interview-calendar-grid";
import { RecruitmentEditor } from "./recruitment-editor";
import { interviewCalendarView } from "../utils/recruitment-format";
import { RecruitmentFilters } from "./recruitment-filters";
export function RecruitmentCalendar() {
  useLocale();
  const { userId, permissions } = useAuthContext();
  const navigate = useNavigate();
  const { day, view, user, updateCalendar, shift } =
    useInterviewCalendarState();
  const [editor, setEditor] = useState<RecruitmentEditorState | null>(null);
  const lookups = useRecruitmentLookups();
  const options = lookups.data ?? {};
  let start = day,
    end = day;
  if (view === "month") {
    start = startOfWeek(startOfMonth(day), { weekStartsOn: 1 });
    end = endOfWeek(endOfMonth(day), { weekStartsOn: 1 });
  }
  if (view === "week") {
    start = startOfWeek(day, { weekStartsOn: 1 });
    end = endOfWeek(day, { weekStartsOn: 1 });
  }
  const params = {
    from_date: format(start, "yyyy-MM-dd"),
    to_date: format(end, "yyyy-MM-dd"),
    user_interview: user,
  };
  const query = useQuery({
    queryKey: ["recruitment-calendar", userId, params],
    queryFn: ({ signal }) => listRecruitment("interviews", params, signal),
    placeholderData: (previous, old) =>
      old?.queryKey[1] === userId ? previous : undefined,
    retry: false,
  });
  const cvLink = useMutation({
    mutationFn: (id: number) =>
      recruitmentObject(API_ENDPOINTS.recruitment.checkInterviewCandidate(id)),
    retry: false,
    onSuccess: (result) => {
      if (typeof result.code_interview === "string")
        navigate(
          `${PAGE_LINKS.interviewDetail(result.code_interview)}?${new URLSearchParams(
            {
              calendar_date: format(day, "yyyy-MM-dd"),
              calendar_view: view,
              calendar_user: user,
            },
          )}`,
        );
    },
  });
  const days = Array.from(
    {
      length:
        Math.round(
          (new Date(format(end, "yyyy-MM-dd")).getTime() -
            new Date(format(start, "yyyy-MM-dd")).getTime()) /
            86400000,
        ) + 1,
    },
    (_, index) => addDays(start, index),
  );
  const createInterviewButton = (
    <Button
      mobileIconOnly
      title={t("interviews", "Tạo lịch phỏng vấn")}
      disabled={!lookups.data || query.isFetching || query.isError}
      onClick={() =>
        setEditor({
          action: "interview",
          row: { start_date: format(day, "yyyy-MM-dd") },
        })
      }
    >
      <CalendarPlus className="size-4" />
      {t("interviews", "Tạo lịch phỏng vấn")}
    </Button>
  );
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <RecruitmentFilters
        mode="interviews"
        values={{
          ...params,
          from_date: format(day, "yyyy-MM-dd"),
          calendar_view: view,
        }}
        lookups={options}
        busy={query.isFetching}
        onApply={(values) => {
          updateCalendar({
            calendar_view: interviewCalendarView(values.calendar_view),
            user_interview: values.user_interview,
            from_date: values.from_date,
          });
        }}
        onReset={() => {
          updateCalendar({
            user_interview: "",
            from_date: format(new Date(), "yyyy-MM-dd"),
          });
        }}
      />
      <div className="hidden flex-wrap items-center justify-between gap-2 sm:flex">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(-1)}
            aria-label={t("interviews", "Khoảng trước")}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            mobileIconOnly
            title={t("interviews", "Hôm nay")}
            variant="outline"
            onClick={() =>
              updateCalendar({ from_date: format(new Date(), "yyyy-MM-dd") })
            }
          >
            <CalendarCheck className="size-4 sm:hidden" aria-hidden="true" />
            {t("interviews", "Hôm nay")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(1)}
            aria-label={t("interviews", "Khoảng sau")}
          >
            <ChevronRight className="size-4" />
          </Button>
          <span className="text-sm font-medium" aria-live="polite">
            {view === "week"
              ? `${format(start, "dd/MM/yyyy")} – ${format(end, "dd/MM/yyyy")}`
              : format(day, view === "day" ? "dd/MM/yyyy" : "MM/yyyy")}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["month", t("interviews", "Tháng"), CalendarDays],
              ["week", t("interviews", "Tuần"), CalendarRange],
              ["day", t("interviews", "Ngày"), Calendar],
            ] as const
          ).map(([value, label, ViewIcon]) => (
            <Button
              key={value}
              mobileIconOnly
              title={label}
              variant={view === value ? "default" : "outline"}
              onClick={() => updateCalendar({ calendar_view: value })}
              aria-pressed={view === value}
            >
              <ViewIcon className="size-4 sm:hidden" aria-hidden="true" />
              {label}
            </Button>
          ))}
          <ResponsivePageAction>{createInterviewButton}</ResponsivePageAction>
        </div>
      </div>
      {lookups.isError && <ErrorToast message={lookups.error.message} />}
      {query.isPending && (
        <LoadingState message={t("interviews", "Đang tải lịch phỏng vấn...")} />
      )}
      {query.isError && <ErrorToast message={query.error.message} />}
      {query.data && (
        <InterviewCalendarGrid
          days={days}
          rows={query.data?.results ?? []}
          view={view}
          disabled={!lookups.data || query.isFetching || query.isError}
          canViewCV={permissions?.can_cv_interview === true}
          interviewers={options.users}
          onCreate={(date, time) => {
            const row: Record<string, unknown> = { start_date: date };
            if (time) {
              row.time_start = time;
              const [hour, minute] = time.split(":").map(Number);
              const end = Math.min(23 * 60 + 59, hour * 60 + minute + 30);
              row.time_end = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
            }
            setEditor({ action: "interview", row });
          }}
          onAction={(action, row) => setEditor({ action, row })}
          onViewCV={(id) => {
            if (!cvLink.isPending) cvLink.mutate(id);
          }}
        />
      )}
      {cvLink.isError && <ErrorToast message={cvLink.error.message} />}
      {editor && lookups.data && (
        <RecruitmentEditor
          state={editor}
          lookups={lookups.data}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
