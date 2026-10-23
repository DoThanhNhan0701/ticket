import { APP_ROUTES } from "@/constants/routes";
import { interviewCalendarView, recruitmentDate } from "./recruitment-format";

/** Restore only calendar filters, never an arbitrary return URL. */
export function interviewCalendarBackLink(params: URLSearchParams) {
  const calendar = new URLSearchParams();
  const date = recruitmentDate(params.get("calendar_date") ?? "");
  if (date) calendar.set("from_date", date);
  if (params.has("calendar_view"))
    calendar.set(
      "calendar_view",
      interviewCalendarView(params.get("calendar_view") ?? ""),
    );
  const user = params.get("calendar_user")?.trim();
  if (user) calendar.set("user_interview", user);
  const search = calendar.toString();
  return APP_ROUTES.recruitment.interviews + (search ? `?${search}` : "");
}

export function interviewCandidateFilters(params: URLSearchParams) {
  return {
    search: params.get("search") ?? "",
    gender: params.get("gender") ?? "",
    cv_status: params.get("cv_status") ?? "",
  };
}
