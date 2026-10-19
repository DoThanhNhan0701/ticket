import { z } from "zod";
import { paginatedResponseSchema } from "@/lib/api/response-schema";

const idSchema = z.number().int();
const nullableIdSchema = idSchema.nullable();
const nullableTextSchema = z.string().nullable();

// List serializers return numeric foreign keys and flattened display names.
// In particular, list_user_received is a string here, not the detail API array.
export const requestTicketSchema = z.object({
  id: idSchema,
  ticket_code: z.string(),
  title: z.string(),
  slug_title: z.string(),
  ticket_type: idSchema,
  ticket_type_name: z.string(),
  ticket_status: idSchema,
  ticket_status_name: z.string(),
  color: z.string(),
  textcolor: z.string(),
  bophansudung: nullableIdSchema,
  bophansudung_name: z.string().optional(),
  list_name_team_use: z.array(z.object({ id: idSchema, name: z.string() })),
  vanphong: idSchema,
  vanphong_name: z.string(),
  duedate: z.string(),
  approve_user: idSchema,
  approve_user_name: z.string(),
  approve_date: nullableTextSchema,
  updating_user: idSchema,
  updating_user_name: z.string(),
  user_create: idSchema,
  username_create: z.string(),
  cancel_user: nullableIdSchema,
  cancel_user_name: z.string().optional(),
  handling_group: idSchema,
  handling_group_name: z.string(),
  assigned_team: nullableIdSchema,
  list_user_received: z.string(),
  fore_cus: nullableIdSchema,
  customer_name: z.string().optional(),
  description: nullableTextSchema,
  data_form: nullableTextSchema,
  created: z.string(),
  time_close: nullableTextSchema,
  time_delete: nullableTextSchema,
  time_done: nullableTextSchema,
  is_handling_group_cancel: z.boolean(),
  is_rehandling: z.boolean(),
  lydohuyyeucau: nullableTextSchema,
  lydokhongxulylai: nullableTextSchema,
  lydoxulylai: nullableTextSchema,
  other1: nullableTextSchema,
  other2: nullableTextSchema,
});

export const requestStatusSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug_name: z.string(),
  description: z.string(),
  color: z.string(),
  textcolor: z.string(),
  is_active: z.boolean(),
  created: z.string(),
  updated: z.string(),
});

export const requestListResponseSchema =
  paginatedResponseSchema(requestTicketSchema);
export const requestStatusesResponseSchema =
  paginatedResponseSchema(requestStatusSchema);

export const requestTypeSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug_name: z.string(),
  handling_group: idSchema,
  handling_group_name: z.string(),
  file_name: nullableTextSchema,
  attachment_file: nullableTextSchema,
  is_active: z.boolean(),
  created: z.string(),
  updated: z.string(),
});

export const requestTypesResponseSchema = z.array(requestTypeSchema);
