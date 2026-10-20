import { z } from "zod";
import { assertTicketSaved } from "./ticket-response";
import { format } from "date-fns";
import { getRequest, postRequest } from "@/lib/api/client";
import {
  parseApiResponse,
  paginatedResponseSchema,
} from "@/lib/api/response-schema";
import { parseSpreadsheet } from "@/lib/api/spreadsheet";
import { settingsLookupsRequest } from "@/features/settings/api/settings-api";
import { requestTypeSchema } from "../schemas/requests-schema";
import {
  getCreateRequestSchema,
  createApproverSchema,
  createCustomerSchema,
  createdRequestSchema,
  type CreateRequestValues,
} from "../schemas/create-request-schema";
import {
  parseRequestDate,
  serializeCreateRequestDetails,
} from "../utils/request-detail-data";
import type { TemplateGroup } from "@/features/settings/schemas/template-schema";

export async function getCreateRequestLookups(signal?: AbortSignal) {
  const [lookups, approvers, customers] = await Promise.all([
    settingsLookupsRequest(
      ["handling-departments", "requesting-departments", "teams", "offices"],
      signal,
    ),
    getRequest<unknown>("/list_useraccept/", {
      params: { is_active: "true" },
      signal,
    }),
    getRequest<unknown>("/list_customer/", { signal }),
  ]);
  return {
    groups: (lookups["handling-departments"] ?? []).filter(
      (row) => row.is_active,
    ),
    departments: (lookups["requesting-departments"] ?? []).filter(
      (row) => row.is_active,
    ),
    teams: (lookups.teams ?? []).filter((row) => row.is_active),
    offices: (lookups.offices ?? []).filter((row) => row.is_active),
    approvers: parseApiResponse(
      z.array(createApproverSchema),
      approvers,
      "Dữ liệu người phê duyệt không hợp lệ.",
    ).filter((row) => row.is_active),
    customers: parseApiResponse(
      z.array(createCustomerSchema),
      customers,
      "Dữ liệu công ty không hợp lệ.",
    ).filter((row) => row.is_active),
  };
}
export type CreateRequestLookups = Awaited<
  ReturnType<typeof getCreateRequestLookups>
>;
export async function getCreateRequestTypes(
  group: string,
  signal?: AbortSignal,
) {
  const rows: z.infer<typeof requestTypeSchema>[] = [];
  let page = 1,
    count = 1;
  while (rows.length < count) {
    const result = parseApiResponse(
      paginatedResponseSchema(requestTypeSchema),
      await getRequest<unknown>("/list_tickettype/", {
        params: {
          handling_group: group,
          page_size: "1000",
          page: String(page++),
        },
        signal,
      }),
      "Dữ liệu loại yêu cầu không hợp lệ.",
    );
    if (!result.results.length && rows.length < result.count)
      throw new Error("Danh sách loại yêu cầu chưa được tải đủ.");
    count = result.count;
    rows.push(...result.results);
  }
  return rows.filter(
    (row) => row.is_active && String(row.handling_group) === group,
  );
}
export async function createRequest(
  input: CreateRequestValues,
  groups: readonly TemplateGroup[],
) {
  const values = parseApiResponse(
    getCreateRequestSchema(groups),
    input,
    "Thông tin yêu cầu không hợp lệ.",
  );
  const date = parseRequestDate(values.duedate);
  if (!date) throw new Error("Ngày mong muốn không hợp lệ.");
  const body = {
    handling_group: Number(values.handling_group),
    ticket_type: Number(values.ticket_type),
    approve_user: Number(values.approve_user),
    fore_cus: Number(values.fore_cus),
    bophansudung: Number(values.bophansudung),
    other1: values.other1.join(","),
    vanphong: Number(values.vanphong),
    title: values.title.trim(),
    description: values.description.trim(),
    duedate: format(date, "yyyy-MM-dd"),
    ticket_status: 1,
    formDataTicket: serializeCreateRequestDetails(groups, values.rows),
  };
  const response = await postRequest<unknown>("/ticket_manager", { body });
  return parseApiResponse(
    createdRequestSchema,
    response,
    "Không xác nhận được kết quả tạo yêu cầu. Kiểm tra danh sách trước khi gửi lại.",
  );
}
export async function uploadRequestAttachment(id: number, file: File) {
  if (file.size > 50 * 1024 * 1024)
    throw new Error(`Tệp “${file.name}” vượt quá 50 MB.`);
  const body = new FormData();
  body.append("ticket_id", String(id));
  body.append("att_file", file);
  const response = await postRequest<unknown>("/attachmentticketfile", {
    body,
  });
  assertTicketSaved(response);
}
export async function exportRequestTemplate(id: number) {
  const body = new FormData();
  body.append("ticket_type_id", String(id));
  return parseSpreadsheet(
    await postRequest<unknown>("/export_ticket_type_template", {
      body,
      responseType: "blob",
    }),
  );
}
export async function importRequestTemplate(id: number, file: File) {
  if (!/\.xlsx$/i.test(file.name))
    throw new Error("Vui lòng chọn tệp Excel .xlsx.");
  const body = new FormData();
  body.append("ticket_type_id", String(id));
  body.append("file", file);
  const response = parseApiResponse(
    z.object({
      message: z.string(),
      dataform: z
        .object({
          data: z.array(
            z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
          ),
        })
        .optional(),
    }),
    await postRequest<unknown>("/import_excel_ticket_form_data", { body }),
    "Phản hồi nhập Excel không hợp lệ.",
  );
  if (response.message !== "success" || !response.dataform)
    throw new Error(response.message || "Không nhập được dữ liệu Excel.");
  return response.dataform.data;
}
