import { format, isValid, parse } from "date-fns";
import { z } from "zod";
import { paginatedResponseSchema } from "@/lib/api/response-schema";
import { requestTypeSchema } from "@/features/requests/schemas/requests-schema";

const idSchema = z.number().int().positive();
const countSchema = z.number().int().nonnegative();
const idStringSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Vui lòng chọn bộ phận xử lý.")
  .refine(
    (value) => Number.isSafeInteger(Number(value)),
    "Bộ phận xử lý không hợp lệ.",
  );

const dateSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    const date = parse(
      value,
      value.includes("-") ? "yyyy-MM-dd" : "d/M/yyyy",
      new Date(),
    );
    if (
      !/^(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/.test(value) ||
      !isValid(date)
    ) {
      context.addIssue({
        code: "custom",
        message: "Vui lòng nhập ngày hợp lệ (DD/MM/YYYY).",
      });
      return z.NEVER;
    }
    return format(date, "yyyy-MM-dd");
  });

export const reportFilterSchema = z
  .object({
    startdate: dateSchema,
    enddate: dateSchema,
    handlinggroup: idStringSchema,
    ticket_type_id: z.string(),
  })
  .refine((values) => values.startdate <= values.enddate, {
    path: ["enddate"],
    message: "Ngày kết thúc phải từ ngày bắt đầu trở đi.",
  });

export const reportGroupSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  group_email: z.string().nullable(),
  is_manager: idSchema.nullable(),
  username_manager: z.string().optional(),
  ls_member: z.array(idSchema),
  created: z.string(),
  updated: z.string(),
});
export const reportGroupsResponseSchema =
  paginatedResponseSchema(reportGroupSchema);
export const reportTypesResponseSchema =
  paginatedResponseSchema(requestTypeSchema);

const rateSchema = z.tuple([
  z.number().min(0).max(100),
  countSchema,
  countSchema,
]);
export const reportSummarySchema = z.object({
  count: countSchema,
  list_code: z.array(z.tuple([z.string(), idSchema])),
});
export const reportResponseSchema = z.object({
  dict_bieudo_01: z.record(z.string(), reportSummarySchema),
  dict_bieudo_02: z.record(z.string(), z.number().nonnegative()),
  dict_bieudo_03: z.record(z.string(), rateSchema),
  dict_bieudo_04: z.record(z.string(), rateSchema),
});

export type ReportFilters = z.infer<typeof reportFilterSchema>;
export type ReportGroup = z.infer<typeof reportGroupSchema>;
export type ReportSummary = z.infer<typeof reportSummarySchema>;
export type ReportResponse = z.infer<typeof reportResponseSchema>;
