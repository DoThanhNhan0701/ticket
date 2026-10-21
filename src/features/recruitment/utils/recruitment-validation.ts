import { z } from "zod";
import { differenceInCalendarMonths, format } from "date-fns";
import type {
  RecruitmentAction,
  RecruitmentField,
  RecruitmentLookups,
  RecruitmentRow,
  RecruitmentValues,
} from "../types";
import {
  names,
  recruitmentDate,
  recruitmentRows,
  recruitmentStoredDate,
  recruitmentText,
} from "./recruitment-format";
export function recruitmentDefaults(
  fields: RecruitmentField[],
  row: RecruitmentRow,
): RecruitmentValues {
  return Object.fromEntries(
    fields.map((field) => {
      let value = row[field.name];
      if (field.readonly && field.lookup)
        return [field.name, readonlyLabel(field, row)];
      if (field.name === "cv_status") value = row.cv_status_id;
      if (field.name === "candidate_source") value = row.candidate_source_id;
      if (field.name === "why_change") value = row.why_change_statuscv;
      if (field.type === "multi")
        return [field.name, defaultAssignees(field, row)];
      if (field.type === "date") {
        return [field.name, recruitmentStoredDate(value)];
      }
      if (
        field.readonly &&
        field.type === "textarea" &&
        typeof DOMParser !== "undefined"
      )
        value = new DOMParser().parseFromString(
          recruitmentText(value),
          "text/html",
        ).body.textContent;
      return [
        field.name,
        field.type === "time"
          ? recruitmentText(value).slice(0, 5)
          : recruitmentText(value),
      ];
    }),
  );
}
function defaultAssignees(field: RecruitmentField, row: RecruitmentRow) {
  if (field.name === "user_interview" && typeof row.user_interview === "string")
    return row.user_interview
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  const source =
    field.name === "user_interview"
      ? "data_user_interview"
      : "data_user_received";
  return recruitmentRows(row[source]).map((user) => String(user.id));
}
function readonlyLabel(field: RecruitmentField, row: RecruitmentRow) {
  const labels: Record<string, unknown> = {
    city_code: row.city_name,
    district_code: row.district_name,
    education_level: row.education_level_name,
    candidate_source: row.candidate_source_name,
    cv_status: row.cv_status_name,
    gender: row.gender,
    ls_user_received: names(row.data_user_received),
  };
  return recruitmentText(labels[field.name]);
}
type FieldError = (name: string, message: string) => void;
function validateTextField(
  field: RecruitmentField,
  value: string,
  now: Date,
  error: FieldError,
) {
  if (!value) return;
  if (field.min && value.length < field.min)
    error(field.name, `Tối thiểu ${field.min} ký tự.`);
  if (field.max && value.length > field.max)
    error(field.name, `Tối đa ${field.max} ký tự.`);
  const checks: Record<string, [boolean, string]> = {
    email: [
      field.type === "email" && !z.email().safeParse(value).success,
      "Email không hợp lệ.",
    ],
    date: [
      field.type === "date" && !recruitmentDate(value),
      "Ngày không hợp lệ.",
    ],
    time: [
      field.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value),
      "Giờ không hợp lệ.",
    ],
    numberphone: [
      field.name === "numberphone" && !/^\d{10,12}$/.test(value),
      "Số điện thoại phải có từ 10 đến 12 chữ số.",
    ],
    quantity: [
      field.name === "quantity" && !/^[1-9]\d*$/.test(value),
      "Số lượng phải là số nguyên dương.",
    ],
    birthday: [
      field.name === "birthday" &&
        recruitmentDate(value) > format(now, "yyyy-MM-dd"),
      "Ngày sinh không được ở tương lai.",
    ],
  };
  for (const [invalid, message] of Object.values(checks))
    if (invalid) error(field.name, message);
}
function validateRecruitmentField(
  field: RecruitmentField,
  value: string | string[],
  options: RecruitmentLookups,
  now: Date,
  error: FieldError,
) {
  if (field.readonly) return;
  if (field.required && !value.length)
    error(
      field.name,
      `Vui lòng ${field.lookup ? "chọn" : "nhập"} ${field.label.toLowerCase()}.`,
    );
  if (field.lookup && value.length) {
    const selected = Array.isArray(value) ? value : [value];
    if (
      selected.some(
        (id) =>
          !(options[field.lookup!] ?? []).some((option) => option.value === id),
      )
    )
      error(field.name, "Lựa chọn không hợp lệ. Vui lòng chọn lại.");
  }
  if (typeof value === "string") validateTextField(field, value, now, error);
}
function validateInterview(
  values: RecruitmentValues,
  editing: boolean,
  now: Date,
  error: FieldError,
) {
  const day = recruitmentDate(String(values.start_date ?? ""));
  const start = String(values.time_start ?? "").slice(0, 5),
    end = String(values.time_end ?? "").slice(0, 5);
  if (start && end && end <= start)
    error("time_end", "Giờ kết thúc phải sau giờ bắt đầu.");
  if (!editing && day && start && new Date(`${day}T${start}`) <= now)
    error("start_date", "Không thể tạo lịch trong quá khứ.");
}
export function recruitmentFormSchema(
  action: RecruitmentAction,
  fields: RecruitmentField[],
  options: RecruitmentLookups,
  editing: boolean,
  now = new Date(),
) {
  return z
    .record(z.string(), z.union([z.string().trim(), z.array(z.string())]))
    .superRefine((values, context) => {
      const error: FieldError = (name, message) =>
        context.addIssue({ code: "custom", path: [name], message });
      for (const field of fields)
        validateRecruitmentField(
          field,
          values[field.name] ?? "",
          options,
          now,
          error,
        );
      if (action === "interview")
        validateInterview(values, editing, now, error);
    });
}
export function validateRecruitmentRange(
  from: string,
  to: string,
  maxMonths?: number,
): string | null {
  const start = recruitmentDate(from),
    end = recruitmentDate(to);
  if (!start || !end) return "Vui lòng nhập đủ khoảng ngày hợp lệ.";
  if (start > end) return "Ngày kết thúc phải từ ngày bắt đầu trở đi.";
  if (
    maxMonths &&
    (differenceInCalendarMonths(new Date(end), new Date(start)) > maxMonths ||
      (differenceInCalendarMonths(new Date(end), new Date(start)) ===
        maxMonths &&
        end.slice(-2) > start.slice(-2)))
  )
    return `Phạm vi tra cứu không quá ${maxMonths} tháng.`;
  return null;
}
