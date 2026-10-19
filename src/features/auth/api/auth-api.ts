import { getRequest, postRequest } from "@/lib/api/client";
import type {
  AuthResponse,
  TicketUserPermissionResponse,
  UserPermissionResponse,
} from "@/features/auth/types";

export async function loginRequest(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const response = await postRequest<AuthResponse>("/token/", {
    body: {
      username: username.trim(),
      password,
    },
  });

  if (
    !response ||
    typeof response.access !== "string" ||
    !response.access.trim() ||
    typeof response.refresh !== "string" ||
    !response.refresh.trim()
  ) {
    throw new Error("Authentication tokens not received from the server.");
  }

  return response;
}

export async function getUserPermissionRequest(): Promise<UserPermissionResponse> {
  const response =
    await getRequest<TicketUserPermissionResponse>("/list_permission/");
  if (
    !response ||
    !Array.isArray(response.infoUser) ||
    typeof response.infoUser[0] !== "number" ||
    typeof response.infoUser[1] !== "string" ||
    !Array.isArray(response.userPermission) ||
    !response.userPermission.every(
      (permission) => typeof permission === "string",
    )
  ) {
    throw new Error("Invalid account information received from the server.");
  }

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
    },
  };
}
