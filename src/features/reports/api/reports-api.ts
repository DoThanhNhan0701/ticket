import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { parseSpreadsheet } from "@/lib/api/spreadsheet";
import { getRequest, postRequest } from "@/lib/api/client";
import { parseApiResponse } from "@/lib/api/response-schema";
import {
  reportFilterSchema,
  reportGroupsResponseSchema,
  reportTypesResponseSchema,
  reportResponseSchema,
  type ReportFilters,
} from "../schemas/reports-schema";

export async function listReportGroupsRequest(signal?: AbortSignal) {
  const response = await getRequest<unknown>(
    API_ENDPOINTS.lookups.handlingGroups,
    {
      params: {
        columnSort: "id",
        typeSort: "ascend",
        is_active: "true",
        page_size: "1000",
        page: "1",
      },
      signal,
    },
  );
  return parseApiResponse(
    reportGroupsResponseSchema,
    response,
    "Dữ liệu bộ phận xử lý không hợp lệ.",
  ).results;
}

export async function listReportTypesRequest(
  groupId: string,
  signal?: AbortSignal,
) {
  const response = await getRequest<unknown>(
    API_ENDPOINTS.lookups.ticketTypes,
    {
      params: { handling_group: groupId, page_size: "1000", page: "1" },
      signal,
    },
  );
  return parseApiResponse(
    reportTypesResponseSchema,
    response,
    "Dữ liệu loại yêu cầu không hợp lệ.",
  ).results;
}

function reportBody(values: ReportFilters) {
  const parsed = parseApiResponse(
    reportFilterSchema,
    values,
    "Thông tin báo cáo không hợp lệ.",
  );
  const body = new FormData();
  body.append("startdate", parsed.startdate);
  body.append("enddate", parsed.enddate);
  body.append("handlinggroup", parsed.handlinggroup);
  return body;
}

export async function getReportRequest(
  values: ReportFilters,
  signal?: AbortSignal,
) {
  const response = await postRequest<unknown>(API_ENDPOINTS.reports.summary, {
    body: reportBody(values),
    signal,
  });
  return parseApiResponse(
    reportResponseSchema,
    response,
    "Dữ liệu báo cáo không hợp lệ.",
  );
}

export async function exportReportRequest(values: ReportFilters) {
  return parseSpreadsheet(
    await postRequest<unknown>(API_ENDPOINTS.reports.exportExcel, {
      body: reportBody(values),
      responseType: "blob",
    }),
  );
}

export async function exportReportDataRequest(values: ReportFilters) {
  const parsed = parseApiResponse(
    reportFilterSchema,
    values,
    "Thông tin truy xuất dữ liệu không hợp lệ.",
  );
  if (
    parsed.ticket_type_id !== "All" &&
    !/^[1-9]\d*$/.test(parsed.ticket_type_id)
  )
    throw new Error("Vui lòng chọn loại yêu cầu.");
  const body = new FormData();
  body.append("from_date", parsed.startdate);
  body.append("to_date", parsed.enddate);
  body.append("bophanxuly_id", parsed.handlinggroup);
  body.append("ticket_type_id", parsed.ticket_type_id);
  return parseSpreadsheet(
    await postRequest<unknown>(API_ENDPOINTS.reports.exportTicketType, {
      body,
      responseType: "blob",
    }),
  );
}
