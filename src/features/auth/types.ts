import type { z } from "zod";
import type { AuthTokens } from "@/lib/api/auth-tokens";
import type { ticketUserPermissionSchema } from "./schemas/account-schema";

export type AuthResponse = AuthTokens;
export type TicketUserPermissionResponse = z.infer<
  typeof ticketUserPermissionSchema
>;

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserPermissions {
  can_create?: boolean;
  can_hr_rec?: boolean;
  can_cv_interview?: boolean;
  can_accept?: boolean;
  can_process?: boolean;
  can_assign?: boolean;
  can_report?: boolean;
  can_report_all_groups?: boolean;
  can_system?: boolean;
  can_allticket?: boolean;
  can_return_ticket?: boolean;
  is_system_manage?: boolean;
  is_handling?: boolean;
  is_admin?: boolean;
  is_superuser?: boolean;
  [key: string]: boolean | undefined;
}

export interface UserPermissionResponse {
  username: string;
  userId: number;
  permission: UserPermissions;
  avatar_url?: string | null;
}
