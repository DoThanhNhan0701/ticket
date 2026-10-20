import { z } from "zod";
import { format } from "date-fns";
import type { TemplateGroup } from "@/features/settings/schemas/template-schema";
import {
  parseRequestDate,
  getCreateRequestGroups,
  validateDetailRows,
} from "../utils/request-detail-data";
import { getRequestGroupNameError } from "../utils/request-code";

const id = z.string().regex(/^[1-9]\d*$/, "Vui lòng chọn thông tin.");
export const createRequestValuesSchema = z.object({
  handling_group: id,
  ticket_type: id,
  approve_user: id,
  fore_cus: id,
  bophansudung: id,
  other1: z.array(id),
  vanphong: id,
  title: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tiêu đề yêu cầu.")
    .max(300, "Tiêu đề tối đa 300 ký tự."),
  description: z.string().trim().max(1000, "Ghi chú tối đa 1000 ký tự."),
  duedate: z.string().refine((value) => {
    const date = parseRequestDate(value);
    return (
      date && format(date, "yyyy-MM-dd") >= format(new Date(), "yyyy-MM-dd")
    );
  }, "Ngày mong muốn phải hợp lệ và không trước hôm nay."),
  rows: z.array(z.object({ values: z.record(z.string(), z.string()) })),
});
export type CreateRequestValues = z.infer<typeof createRequestValuesSchema>;
export type DetailRow = CreateRequestValues["rows"][number];

export const requestAssignmentSchema = createRequestValuesSchema.pick({
  handling_group: true,
  ticket_type: true,
  approve_user: true,
  fore_cus: true,
});
export const requestGeneralSchema = createRequestValuesSchema.pick({
  title: true,
  bophansudung: true,
  other1: true,
  vanphong: true,
  duedate: true,
});

export function getCreateRequestSchema(
  groups: readonly TemplateGroup[],
  handlingGroups: readonly { id: number; name?: string }[] = [],
) {
  return createRequestValuesSchema.superRefine((values, context) => {
    const handlingGroup = handlingGroups.find(
      (group) => String(group.id) === values.handling_group,
    );
    const groupError = getRequestGroupNameError(handlingGroup?.name ?? "");
    if (groupError)
      context.addIssue({
        code: "custom",
        path: ["handling_group"],
        message: groupError,
      });
    for (const issue of validateDetailRows(
      getCreateRequestGroups(groups),
      values.rows,
    ))
      context.addIssue({ code: "custom", ...issue });
  });
}

export const createApproverSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  is_active: z.boolean(),
});
export const createCustomerSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  is_active: z.boolean(),
});
export const createdRequestSchema = z.object({
  id: z.number().int().positive(),
  ticket_code: z.string().optional(),
});
export type CreatedRequest = z.infer<typeof createdRequestSchema>;
