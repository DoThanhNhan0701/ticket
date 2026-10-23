import { ErrorToast } from "@/components/error-toast";
import { PAGE_LINKS } from "@/constants/routes";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { ResponsivePageAction } from "@/components/layout/mobile-page-action";
import { useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
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
import { ErrorAlert } from "@/components/error-alert";
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
  const { userId, permissions } = useAuthContext();
  const navigate = useNavigate();
  const [day, setDay] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("week");
  const [editor, setEditor] = useState<RecruitmentEditorState | null>(null);
  const [user, setUser] = useState("");
  const lookups = useRecruitmentLookups();
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
        navigate(PAGE_LINKS.interviewDetail(result.code_interview));
    },
  });
  const shift = (amount: number) =>
    setDay((current) => {
      if (view === "month") return addMonths(current, amount);
      if (view === "week") return addWeeks(current, amount);
      return addDays(current, amount);
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
      title="Tạo lịch phỏng vấn"
      disabled={!lookups.data || query.isFetching || query.isError}
      onClick={() =>
        setEditor({
          action: "interview",
          row: { start_date: format(day, "yyyy-MM-dd") },
        })
      }
    >
      <CalendarPlus className="size-4" />
      Tạo lịch phỏng vấn
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
        lookups={lookups.data ?? {}}
        busy={query.isFetching}
        onApply={(values) => {
          setView(interviewCalendarView(values.calendar_view));
          setUser(values.user_interview);
          setDay(new Date(`${values.from_date}T12:00:00`));
        }}
        onReset={() => {
          setUser("");
          setDay(new Date());
        }}
      />
      <div className="hidden flex-wrap items-center justify-between gap-2 sm:flex">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(-1)}
            aria-label="Khoảng trước"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            mobileIconOnly
            title="Hôm nay"
            variant="outline"
            onClick={() => setDay(new Date())}
          >
            <CalendarCheck className="size-4 sm:hidden" aria-hidden="true" />
            Hôm nay
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(1)}
            aria-label="Khoảng sau"
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
              ["month", "Tháng", CalendarDays],
              ["week", "Tuần", CalendarRange],
              ["day", "Ngày", Calendar],
            ] as const
          ).map(([value, label, ViewIcon]) => (
            <Button
              key={value}
              mobileIconOnly
              title={label}
              variant={view === value ? "default" : "outline"}
              onClick={() => setView(value)}
              aria-pressed={view === value}
            >
              <ViewIcon className="size-4 sm:hidden" aria-hidden="true" />
              {label}
            </Button>
          ))}
          <ResponsivePageAction>{createInterviewButton}</ResponsivePageAction>
        </div>
      </div>
      {lookups.isError && (
        <div className="space-y-2">
          <ErrorAlert message={lookups.error.message} />
          <Button onClick={() => void lookups.refetch()}>
            Thử lại danh mục
          </Button>
        </div>
      )}
      {query.isPending && <LoadingState message="Đang tải lịch phỏng vấn..." />}
      {query.isError && (
        <div className="space-y-3">
          <ErrorAlert message={query.error.message} />
          <Button onClick={() => void query.refetch()}>Thử lại lịch</Button>
        </div>
      )}
      {query.data && (
        <InterviewCalendarGrid
          days={days}
          rows={query.data?.results ?? []}
          view={view}
          disabled={!lookups.data || query.isFetching || query.isError}
          canViewCV={permissions?.can_cv_interview === true}
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
