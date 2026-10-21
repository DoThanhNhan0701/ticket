import { z } from "zod";
import { parseApiResponse } from "@/lib/api/response-schema";
import type { RecruitmentOption } from "../types";

const base = "https://provinces.open-api.vn/api/v2";
const division = z.object({
  code: z.number().int().positive(),
  name: z.string().min(1),
});
const ward = division.extend({ province_code: z.number().int().positive() });
async function load(path: string, signal?: AbortSignal): Promise<unknown> {
  // This public service must never receive the application's authentication headers.
  const response = await fetch(`${base}${path}`, {
    signal,
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error("Không tải được danh mục địa chỉ. Vui lòng thử lại.");
  return response.json();
}
export async function listVietnamProvinces(
  signal?: AbortSignal,
): Promise<RecruitmentOption[]> {
  return parseApiResponse(
    z.array(division),
    await load("/p/", signal),
    "Danh sách tỉnh/thành phố không hợp lệ.",
  ).map(({ code, name }) => ({
    value: String(code).padStart(2, "0"),
    label: name,
  }));
}
export async function listVietnamWards(
  province: string,
  signal?: AbortSignal,
): Promise<RecruitmentOption[]> {
  if (!/^\d{2}$/.test(province))
    throw new Error("Mã tỉnh/thành phố không hợp lệ.");
  const rows = parseApiResponse(
    z.array(ward),
    await load(`/w/?province=${Number(province)}`, signal),
    "Danh sách xã/phường/đặc khu không hợp lệ.",
  );
  if (rows.some((row) => row.province_code !== Number(province)))
    throw new Error("Danh sách xã/phường không thuộc tỉnh đã chọn.");
  return rows.map(({ code, name }) => ({
    value: String(code).padStart(5, "0"),
    label: name,
  }));
}
