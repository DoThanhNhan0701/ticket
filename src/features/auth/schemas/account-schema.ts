import { z } from "zod";

const namedOptionSchema = z.object({ id: z.number().int(), name: z.string() });
const coloredOptionSchema = namedOptionSchema.extend({ color: z.string() });

export const ticketUserPermissionSchema = z.object({
  infoUser: z.tuple([z.number().int(), z.string(), z.string().nullable()]),
  userPermission: z.array(z.string()),
  handlingPermission: z.record(z.string(), z.array(z.string())),
  is_handling: z.boolean(),
  is_superuser: z.boolean(),
  is_admin: z.boolean().optional(),
  can_assign: z.boolean().optional(),
  ls_permission: z.array(
    namedOptionSchema.extend({ team__name: z.string().nullable() }),
  ),
  ls_department: z.array(namedOptionSchema),
  ls_cv_status: z.array(coloredOptionSchema),
  ls_ticket_status: z.array(
    coloredOptionSchema.extend({ textcolor: z.string() }),
  ),
});

export const cachedUserPermissionSchema = z.object({
  username: z.string(),
  userId: z.number().int(),
  avatar_url: z.string().nullable().optional(),
  permission: z.record(z.string(), z.boolean()),
});
