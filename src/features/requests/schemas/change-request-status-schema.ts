import { z } from "zod";

export const changeRequestStatusFormSchema = z.object({
  ticket_code: z.string().trim().min(1, "Vui lòng nhập mã yêu cầu."),
  ticket_status_id: z.string().regex(/^[1-9]\d*$/, "Vui lòng chọn trạng thái."),
  lydohuyyeucau: z.string().trim(),
});

export const changeRequestStatusRequestSchema = z.object({
  ticket_code: z.string().trim().min(1),
  ticket_status_id: z
    .number()
    .int()
    .positive()
    .refine((id) => id !== 1),
  lydohuyyeucau: z.string().trim(),
});

export const changeRequestStatusResponseSchema = z
  .object({
    message: z.string(),
    error: z.string(),
  })
  .refine((response) =>
    Boolean(response.message.trim() || response.error.trim()),
  );

export type ChangeRequestStatusFormValues = z.infer<
  typeof changeRequestStatusFormSchema
>;
export type ChangeRequestStatusRequest = z.infer<
  typeof changeRequestStatusRequestSchema
>;
export type ChangeRequestStatusResponse = z.infer<
  typeof changeRequestStatusResponseSchema
>;
