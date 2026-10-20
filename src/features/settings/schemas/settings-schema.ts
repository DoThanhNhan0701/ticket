import { z } from "zod";
import { reportGroupSchema } from "@/features/reports/schemas/reports-schema";
import { paginatedResponseSchema } from "@/lib/api/response-schema";

const id = z.number().int().positive();
const nullableId = id.nullable();
const named = z.object({
  id,
  name: z.string(),
  is_active: z.boolean(),
  created: z.string(),
  updated: z.string(),
});
export const departmentSchema = named.extend({ is_handling: z.boolean() });
export const teamSchema = departmentSchema.extend({ bophan: nullableId });
export const officeSchema = named.extend({ slug_name: z.string() });
export const positionSchema = named.extend({
  description: z.string().nullable(),
  permission: z.array(id),
});
export const positionPermissionSchema = named.extend({
  description: z.string().nullable(),
});
export const settingsUserSchema = z
  .object({
    id,
    username: z.string(),
    is_active: z.boolean(),
    is_superuser: z.boolean(),
    is_staff: z.boolean(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    msnv: z.string().nullable(),
    email: z.string(),
    date_joined: z.string(),
    last_login: z.string().nullable(),
    date_lock: z.string().nullable(),
    updated: z.string(),
    avatar: z.string().nullable(),
    birthday: z.string().nullable(),
    team: nullableId,
    bophan: nullableId,
    chucvu: nullableId,
    groups: z.array(id),
    user_permissions: z.array(id),
    ls_permission: z.array(id),
    avatar_full: z.string().optional(),
  })
  .transform((user) => ({
    ...user,
    name:
      [user.last_name, user.first_name].filter(Boolean).join(" ") ||
      user.username,
  }));
export const settingsRequestTypeSchema = named.extend({
  handling_group: id,
  handling_group_name: z.string(),
  slug_name: z.string(),
  file_name: z.string().nullable(),
  attachment_file: z.string().nullable(),
});
export const settingsListSchemas = {
  users: z.array(settingsUserSchema),
  "requesting-departments": paginatedResponseSchema(departmentSchema),
  "handling-departments": paginatedResponseSchema(reportGroupSchema),
  "request-types": paginatedResponseSchema(settingsRequestTypeSchema),
  teams: z.array(teamSchema),
  positions: z.array(positionSchema),
  offices: z.array(officeSchema),
};
export const settingsDetailSchemas = {
  users: settingsUserSchema,
  "requesting-departments": departmentSchema,
  "handling-departments": reportGroupSchema,
  "request-types": settingsRequestTypeSchema,
  teams: teamSchema,
  positions: positionSchema,
  offices: officeSchema,
};
