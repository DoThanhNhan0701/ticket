import { z } from "zod";
import {
  templateFieldSchema,
  templateGroupSchema,
} from "@/features/settings/schemas/template-schema";

const text = z
  .string()
  .nullish()
  .transform((value) => value ?? "");
const files = z.record(z.string(), z.string());
export const ticketMessageSchema = z.object({
  id: z.number(),
  username: text,
  created: text,
  content: text,
  avatar: text,
  att_file: files.nullish().transform((value) => value ?? {}),
});
export const ticketCommentSchema = ticketMessageSchema.extend({
  item_comment: z
    .array(ticketMessageSchema)
    .nullish()
    .transform((value) => value ?? []),
});
const header = templateGroupSchema.extend({
  children: z.array(
    templateFieldSchema.extend({ type: z.string().default("text") }),
  ),
});
export const requestDetailSchema = z.object({
  id: z.number().int().positive(),
  ticket_code: text,
  title: text,
  ticket_status: z.number(),
  ticket_status_name: text,
  color: text,
  handling_group_name: text,
  ticket_type_name: text,
  approve_user_name: text,
  customer_name: text,
  bophansudung_name: text,
  vanphong_name: text,
  username_create: text,
  duedate: text,
  created: text,
  approve_date: text,
  description: text,
  lydohuyyeucau: text,
  lydoxulylai: text,
  lydokhongxulylai: text,
  ticket_type_att_file: text,
  list_button: files.nullish().transform((value) => value ?? {}),
  list_user_not_received: z
    .record(z.string(), z.union([z.number(), z.string()]))
    .nullish()
    .transform((value) => value ?? {}),
  list_name_team_use: z
    .array(z.object({ name: z.string() }))
    .nullish()
    .transform((value) => value ?? []),
  list_user_received: z
    .array(
      z.object({
        username: text,
        user_id: z.union([z.number(), z.string()]).nullish(),
        status: text,
      }),
    )
    .nullish()
    .transform((value) => value ?? []),
  attachment_files: files.nullish().transform((value) => value ?? {}),
  comments: z
    .array(ticketCommentSchema)
    .nullish()
    .transform((value) => value ?? []),
  data_item: z.preprocess(
    (value) => (value === "" ? null : value),
    z
      .object({
        dataform: z.object({
          header: z.array(header),
          data: z.array(
            z.record(
              z.string(),
              z.union([z.string(), z.number(), z.boolean(), z.null()]),
            ),
          ),
        }),
      })
      .nullish(),
  ),
});
export const ticketHistorySchema = z.array(
  z.object({
    id: z.number().optional(),
    username: text,
    created: text,
    system_log: text,
    user_log: text,
    comment_content: text,
  }),
);
export type RequestDetailData = z.infer<typeof requestDetailSchema>;
export type TicketComment = z.infer<typeof ticketCommentSchema>;
export type TicketMessage = z.infer<typeof ticketMessageSchema>;
