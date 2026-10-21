import { format, isValid, parse, subMonths } from "date-fns";
import type { RecruitmentOption, RecruitmentRow } from "../types";
export const recruitmentText = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";
export function recruitmentRows(value: unknown): RecruitmentRow[] {
  return Array.isArray(value)
    ? value.filter(
        (row): row is RecruitmentRow =>
          Boolean(row) && typeof row === "object" && !Array.isArray(row),
      )
    : [];
}
export function recruitmentOptions(
  value: unknown,
  id = "id",
  label = "name",
): RecruitmentOption[] {
  return recruitmentRows(value)
    .map((row) => ({
      value: recruitmentText(row[id]),
      label: recruitmentText(row[label]),
    }))
    .filter((row) => row.value && row.label);
}
export function defaultRecruitmentDates() {
  const now = new Date();
  return {
    from_date: format(subMonths(now, 6), "yyyy-MM-dd"),
    to_date: format(now, "yyyy-MM-dd"),
  };
}
export function recruitmentDate(value: string): string {
  if (!value) return "";
  const pattern = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? "yyyy-MM-dd"
    : "dd/MM/yyyy";
  const parsed = parse(value, pattern, new Date());
  return isValid(parsed) && format(parsed, pattern) === value
    ? format(parsed, "yyyy-MM-dd")
    : "";
}

const businessDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function recruitmentStoredDate(value: unknown): string {
  const text = recruitmentText(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) return recruitmentDate(text);
  const date = new Date(text);
  if (!isValid(date)) return "";
  const parts = businessDateFormat.formatToParts(date);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
}
export function recruitmentFileHref(value: unknown): string | undefined {
  const path = recruitmentText(value);
  if (!path) return;
  try {
    const origin =
      typeof window === "undefined"
        ? "http://localhost"
        : window.location.origin;
    const base = new URL(import.meta.env.VITE_API_BASE_URL || "/", origin);
    const url = new URL(path, base.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return;
  }
}
export function names(value: unknown) {
  return recruitmentRows(value)
    .map((row) => recruitmentText(row.username || row.name))
    .filter(Boolean)
    .join(", ");
}
