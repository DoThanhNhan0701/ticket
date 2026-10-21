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
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingState } from "@/components/loading-state";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import type { RecruitmentEditorState } from "../types";
import { listRecruitment, recruitmentObject } from "../api/recruitment-api";
import { useRecruitmentLookups } from "../hooks/use-recruitment-lookups";
import { InterviewCalendarGrid } from "./interview-calendar-grid";
import { RecruitmentEditor } from "./recruitment-editor";
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
    retry: false,
  });
  const cvLink = useMutation({
    mutationFn: (id: number) => recruitmentObject(`/check-cv-interview/${id}`),
    retry: false,
    onSuccess: (result) => {
      if (typeof result.code_interview === "string")
        navigate(
          `/recruitment/interviews/${encodeURIComponent(result.code_interview)}`,
        );
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
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <RecruitmentFilters
        mode="interviews"
        values={{ ...params, from_date: format(day, "yyyy-MM-dd") }}
        lookups={lookups.data ?? {}}
        busy={query.isFetching}
        onApply={(values) => {
          setUser(values.user_interview);
          setDay(new Date(`${values.from_date}T12:00:00`));
        }}
        onReset={() => {
          setUser("");
          setDay(new Date());
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(-1)}
            aria-label="Khoảng trước"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => setDay(new Date())}>
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
              ["month", "Tháng"],
              ["week", "Tuần"],
              ["day", "Ngày"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={view === value ? "default" : "outline"}
              onClick={() => setView(value)}
              aria-pressed={view === value}
            >
              {label}
            </Button>
          ))}
          <Button
            disabled={!lookups.data || query.isFetching}
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
      {!query.isPending && !query.isError && (
        <InterviewCalendarGrid
          days={days}
          rows={query.data?.results ?? []}
          view={view}
          disabled={!lookups.data || query.isFetching}
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
      {cvLink.isError && <ErrorAlert message={cvLink.error.message} />}
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
