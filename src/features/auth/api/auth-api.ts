import { getRequest, postRequest } from "@/lib/api/client";
import type {
  AuthResponse,
  LoginRequest,
  UserPermissionResponse,
} from "@/features/auth/types";
import { authTokensSchema } from "@/lib/api/auth-tokens";
import { parseApiResponse } from "@/lib/api/response-schema";
import { ticketUserPermissionSchema } from "../schemas/account-schema";

export async function loginRequest(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const body: LoginRequest = { username: username.trim(), password };
  const response = await postRequest<unknown>("/token/", {
    body,
  });
  return parseApiResponse(
    authTokensSchema,
    response,
    "Authentication tokens not received from the server.",
  );
}

export async function getUserPermissionRequest(): Promise<UserPermissionResponse> {
  const response = parseApiResponse(
    ticketUserPermissionSchema,
    await getRequest<unknown>("/list_permission/"),
    "Invalid account information received from the server.",
  );

  const [userId, username, avatarUrl] = response.infoUser;
  const roles = [
    ...response.userPermission,
    ...Object.values(response.handlingPermission ?? {}).flat(),
  ];

  return {
    userId,
    username,
    avatar_url: avatarUrl ?? null,
    permission: {
      ...Object.fromEntries(roles.map((role) => [role, true])),
      is_admin: response.is_admin ?? false,
      is_superuser: response.is_superuser ?? false,
      is_handling: response.is_handling ?? false,
      can_process: response.is_handling ?? false,
      can_assign: response.can_assign ?? false,
      can_report_all_groups: Object.keys(response.handlingPermission).includes(
        "AD",
      ),
    },
  };
}
