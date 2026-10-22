import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { z } from "zod";
import {
  getRequest,
  postRequest,
  putRequest,
  deleteRequest,
} from "@/lib/api/client";
import { ApiError } from "@/lib/api/api-error";
import { parseApiResponse } from "@/lib/api/response-schema";
import type {
  RecruitmentKind,
  RecruitmentRow,
  RecruitmentListData,
  RecruitmentLookups,
} from "../types";
import {
  recruitmentOptions,
  recruitmentRows,
} from "../utils/recruitment-format";
const rowSchema = z.looseObject({ id: z.number().int().positive().optional() });
const listSchema = z.looseObject({
  count: z.number().nonnegative().nullable(),
  results: z.array(rowSchema),
});
const objectSchema = z.record(z.string(), z.unknown());
export const recruitmentEndpoints = {
  requests: API_ENDPOINTS.recruitment.requests,
  candidates: API_ENDPOINTS.recruitment.candidates,
} as const;
export async function listRecruitment(
  kind: RecruitmentKind | "interviews",
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<RecruitmentListData> {
  const result = parseApiResponse(
    listSchema,
    await getRequest<unknown>(
      kind === "interviews"
        ? API_ENDPOINTS.recruitment.interviews
        : recruitmentEndpoints[kind],
      {
        params: Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== ""),
        ),
        signal,
      },
    ),
    "Dữ liệu tuyển dụng không hợp lệ.",
  );
  return {
    count: result.count ?? result.results.length,
    results: result.results,
  };
}
export async function recruitmentObject(
  path: string,
  params?: Record<string, string>,
  signal?: AbortSignal,
) {
  return parseApiResponse(
    objectSchema,
    await getRequest<unknown>(path, { params, signal }),
    "Dữ liệu tuyển dụng không hợp lệ.",
  );
}
export async function recruitmentArray(
  path: string,
  params?: Record<string, string>,
  signal?: AbortSignal,
): Promise<RecruitmentRow[]> {
  return parseApiResponse(
    z.array(rowSchema),
    await getRequest<unknown>(path, { params, signal }),
    "Dữ liệu danh mục tuyển dụng không hợp lệ.",
  );
}
export async function recruitmentDetail(
  kind: RecruitmentKind,
  id: number,
  signal?: AbortSignal,
) {
  const result = await recruitmentObject(
    kind === "requests"
      ? API_ENDPOINTS.recruitment.requestDetail(id)
      : API_ENDPOINTS.recruitment.candidateDetail(id),
    undefined,
    signal,
  );
  const row = parseApiResponse(
    rowSchema,
    result.results,
    "Không tải được thông tin tuyển dụng.",
  );
  return { row, reasons: recruitmentOptions(result.list_reason_recruitment) };
}
export async function recruitmentLookups(
  signal?: AbortSignal,
): Promise<RecruitmentLookups> {
  const [departments, status, city, users, info] = await Promise.all([
    recruitmentArray(API_ENDPOINTS.recruitment.departments, undefined, signal),
    recruitmentArray(API_ENDPOINTS.recruitment.statuses, undefined, signal),
    recruitmentArray(API_ENDPOINTS.recruitment.cities, undefined, signal),
    recruitmentArray(API_ENDPOINTS.lookups.users, undefined, signal),
    recruitmentObject(API_ENDPOINTS.recruitment.inputInfo, undefined, signal),
  ]);
  return {
    departments: recruitmentOptions(departments),
    statuses: recruitmentOptions(
      status.filter((row) => row.is_active !== false),
    ),
    cities: recruitmentOptions(city, "code"),
    users: recruitmentOptions(
      users.filter((row) => row.is_active !== false),
      "id",
      "username",
    ),
    education: recruitmentOptions(info.list_education_level),
    sources: recruitmentOptions(info.list_candidate_source),
  };
}
export async function recruitmentWrite(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
  params?: Record<string, string>,
) {
  const send = { POST: postRequest, PUT: putRequest, DELETE: deleteRequest }[
    method
  ];
  const result = await send<unknown>(path, { body, params });
  if (result && typeof result === "object" && "error" in result && result.error)
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Không lưu được dữ liệu tuyển dụng.",
    );
  return result;
}
export function recruitmentMultipart(
  values: unknown,
  files: Record<string, File | undefined> = {},
) {
  const body = new FormData();
  body.append("values", JSON.stringify(values));
  for (const [key, file] of Object.entries(files))
    if (file) body.append(key, file);
  return body;
}
export async function exportRecruitment(
  kind: RecruitmentKind | "reports",
  params: Record<string, string>,
) {
  const body = new FormData();
  for (const [key, value] of Object.entries(params))
    if (value) body.append(key, value);
  const paths = {
    requests: API_ENDPOINTS.recruitment.exportRequests,
    candidates: API_ENDPOINTS.recruitment.exportCandidates,
    reports: API_ENDPOINTS.recruitment.exportReport,
  };
  const result = await postRequest<unknown>(paths[kind], {
    body,
    responseType: "blob",
  });
  if (!(result instanceof Blob) || result.size === 0)
    throw new Error("Không nhận được tệp Excel hợp lệ. Vui lòng thử lại.");
  return result;
}
export async function interviewDetail(
  code: string,
  params?: Record<string, string>,
  signal?: AbortSignal,
) {
  try {
    return await recruitmentArray(
      API_ENDPOINTS.recruitment.interviewDetail(code),
      params,
      signal,
    );
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 400 &&
      error.message === "Không tìm thấy ứng viên."
    )
      return [];
    throw error;
  }
}
export const interviewCandidates = (row: RecruitmentRow) =>
  recruitmentRows(
    row.ls_cv_interview ?? row.data_cv ?? row.list_cv ?? row.results,
  );

export async function downloadRecruitmentNote(id: number) {
  const result = await getRequest<unknown>(
    API_ENDPOINTS.recruitment.downloadNote(id),
    {
      responseType: "file",
    },
  );
  if (!(result instanceof Blob) || result.size === 0)
    throw new Error("Không tải được tệp ghi chú.");
  return result;
}
