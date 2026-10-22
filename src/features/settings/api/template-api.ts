import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { z } from "zod";
import { getRequest, postRequest, putRequest } from "@/lib/api/client";
import { parseApiResponse } from "@/lib/api/response-schema";
import {
  prepareTemplate,
  templateResponseSchema,
  type TemplateGroup,
} from "../schemas/template-schema";

export async function getRequestTemplate(id: number, signal?: AbortSignal) {
  const response = await getRequest<unknown>(
    API_ENDPOINTS.settings.template(id),
    {
      signal,
    },
  );
  const missing = z
    .object({ message: z.literal("The ticket type template does not exist") })
    .safeParse(response);
  if (missing.success) return { exists: false, forms: [] as TemplateGroup[] };
  return {
    exists: true,
    ...parseApiResponse(
      templateResponseSchema,
      response,
      "Dữ liệu biểu mẫu không hợp lệ.",
    ),
  };
}
export async function saveRequestTemplate(
  id: number,
  userId: number,
  forms: readonly TemplateGroup[],
  exists: boolean,
) {
  const body = {
    ticket_type: id,
    data_form: { forms: prepareTemplate(forms) },
    user: userId,
    mota: "auto",
    ghichu: "auto",
  };
  const response = await (exists
    ? putRequest<unknown>(API_ENDPOINTS.settings.template(id), { body })
    : postRequest<unknown>(API_ENDPOINTS.settings.templates, { body }));
  if (
    typeof response === "object" &&
    response !== null &&
    "error" in response &&
    response.error
  )
    throw new Error("Không lưu được biểu mẫu. Vui lòng kiểm tra thông tin.");
  const saved = await getRequestTemplate(id);
  if (
    !saved.exists ||
    !containsTemplateValues(body.data_form.forms, prepareTemplate(saved.forms))
  )
    throw new Error(
      "Chưa xác nhận được thay đổi biểu mẫu. Vui lòng tải lại để kiểm tra.",
    );
  return saved;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function containsTemplateValues(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected))
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((value, index) =>
        containsTemplateValues(value, actual[index]),
      )
    );
  if (isRecord(expected))
    return (
      isRecord(actual) &&
      Object.entries(expected).every(
        ([key, value]) =>
          value === undefined || containsTemplateValues(value, actual[key]),
      )
    );
  return expected === actual;
}
