import { recruitmentMultipart, recruitmentWrite } from "../api/recruitment-api";
import type { RecruitmentEditorState, RecruitmentValues } from "../types";
import {
  recruitmentFields,
  recruitmentUploadNames,
} from "./recruitment-fields";
import { recruitmentDate } from "./recruitment-format";
import { validateTimeRange } from "@/lib/time-range";
export async function saveRecruitmentAction(
  state: RecruitmentEditorState,
  values: RecruitmentValues,
  files: Record<string, File | undefined>,
) {
  const id = state.row.id;
  const allowedUploads = recruitmentUploadNames(state.action);
  files = Object.fromEntries(
    Object.entries(files).filter(([name]) => allowedUploads.includes(name)),
  );
  const data = recruitmentPayload(state, values);
  const body = (extra: Record<string, unknown> = {}) =>
    recruitmentMultipart({ ...data, ...extra }, files);
  switch (state.action) {
    case "request":
      return recruitmentWrite(`/detail_recruitment/${id}`, "PUT", body());
    case "create-candidate":
      return recruitmentWrite(
        `/detail_cv/${id}`,
        "POST",
        body({ department_recruited: state.row.department_recruited }),
      );
    case "candidate":
      return recruitmentWrite(`/detail_cv/${id}`, "PUT", body());
    case "interview":
      return recruitmentWrite(
        "/regis-interview/",
        id ? "PUT" : "POST",
        body(id ? { id_interview: id } : {}),
      );
    default:
      return saveAdditionalAction(state, data, files);
  }
}
async function saveAdditionalAction(
  state: RecruitmentEditorState,
  data: Record<string, unknown>,
  files: Record<string, File | undefined>,
) {
  const id = state.row.id;
  const body = () => recruitmentMultipart(data, files);
  switch (state.action) {
    case "status": {
      const form = new FormData();
      form.append("code_cv", String(state.row.code_cv));
      form.append("cv_status", String(data.cv_status));
      form.append("why_change", String(data.why_change ?? ""));
      return recruitmentWrite(`/change_status_cv/${id}`, "PUT", form);
    }
    case "delete-interview":
      return recruitmentWrite(`/regis-interview/${id}`, "DELETE");
    case "delete-candidate":
      return recruitmentWrite("/del-data-cv/", "POST", { id_cv: id });
    case "delete-file": {
      const form = new FormData();
      form.append("id_cv", String(id));
      form.append("name_file_cv", String(state.row.name_file_cv));
      return recruitmentWrite("/del-file-cv/", "POST", form);
    }
    case "attach": {
      const form = new FormData();
      form.append("ls_id_cv", JSON.stringify(state.ids ?? [id]));
      form.append("id_interview", String(data.id_interview));
      return recruitmentWrite("/add-cv-interview/", "POST", form);
    }
    case "note": {
      if (!String(data.note ?? "").trim() && !files.file_note)
        throw new Error("Vui lòng nhập ghi chú hoặc đính kèm tệp.");
      const form = body();
      form.append("id_cv", String(id));
      return recruitmentWrite("/note-cv/", "POST", form);
    }
    case "remove-interview-cv":
      return recruitmentWrite("/del-cv-interview/", "DELETE", undefined, {
        ls_id_cv: JSON.stringify(state.ids ?? [id]),
        code_interview: state.code ?? "",
      });
    case "candidate-time":
      return saveCandidateInterviewTime(state, data);
    default:
      throw new Error("Thao tác không hợp lệ.");
  }
}

function saveCandidateInterviewTime(
  state: RecruitmentEditorState,
  data: Record<string, unknown>,
) {
  const issue = validateTimeRange(
    String(data.time_start ?? ""),
    state.timeRange?.start,
    state.timeRange?.end,
  );
  if (issue) throw new Error(issue);
  return recruitmentWrite("/detail-cv-interview/", "POST", {
    id_cv: state.row.id,
    id_interview: state.row.id_interview,
    time_start: data.time_start || null,
  });
}

function recruitmentPayload(
  state: RecruitmentEditorState,
  values: RecruitmentValues,
) {
  const editableFields = new Set(
    recruitmentFields(state.action)
      .filter((field) => !field.readonly)
      .map((field) => field.name),
  );
  const data: Record<string, unknown> = Object.fromEntries(
    Object.entries(values).filter(([key]) => editableFields.has(key)),
  );
  if (state.action === "create-candidate")
    for (const [key, value] of Object.entries(data))
      if (value === "") delete data[key];
  normalizeNumericFields(data);
  // Keep address codes as strings, including leading zeroes. The current backend
  // stores the five-digit ward code in its existing district_code field.
  if (Array.isArray(data.user_interview) && data.user_interview.length === 0)
    delete data.user_interview;
  normalizeDateFields(data);
  for (const key of ["user_interview", "ls_user_received"])
    if (Array.isArray(data[key]))
      data[key] = (data[key] as string[]).map(Number);
  if (
    state.action === "create-candidate" &&
    typeof data.application_date === "string" &&
    data.application_date
  )
    data.application_date = new Date(
      `${data.application_date}T00:00:00`,
    ).toISOString();
  return data;
}

function normalizeNumericFields(data: Record<string, unknown>) {
  for (const key of [
    "education_level",
    "candidate_source",
    "cv_status",
    "reason_recr_id",
  ])
    if (data[key] !== undefined && data[key] !== "" && data[key] !== null)
      data[key] = Number(data[key]);
}
function normalizeDateFields(data: Record<string, unknown>) {
  for (const key of ["birthday", "application_date", "start_date"]) {
    const value = data[key];
    if (typeof value === "string") data[key] = recruitmentDate(value) || null;
  }
}
