import { addDays, addMonths, addWeeks, format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import {
  interviewCalendarView,
  recruitmentDate,
} from "../utils/recruitment-format";

export function useInterviewCalendarState() {
  const [params, setParams] = useSearchParams();
  const date = recruitmentDate(params.get("from_date") ?? "");
  const day = date ? new Date(`${date}T12:00:00`) : new Date();
  const view = interviewCalendarView(params.get("calendar_view") ?? "");
  const user = params.get("user_interview")?.trim() ?? "";
  const updateCalendar = (values: Record<string, string>) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries({
        from_date: format(day, "yyyy-MM-dd"),
        calendar_view: view,
        user_interview: user,
        ...values,
      })) {
        if (value.trim()) next.set(key, value.trim());
        else next.delete(key);
      }
      return next;
    });
  const shift = (amount: number) => {
    let next = addDays(day, amount);
    if (view === "month") next = addMonths(day, amount);
    if (view === "week") next = addWeeks(day, amount);
    updateCalendar({ from_date: format(next, "yyyy-MM-dd") });
  };
  return { day, view, user, updateCalendar, shift };
}
