export interface AuthResponse {
  access: string;
  refresh: string;
}

export interface TicketUserPermissionResponse {
  infoUser: [userId: number, username: string, avatarUrl?: string | null];
  userPermission: string[];
  handlingPermission?: Record<string, string[]>;
  is_handling?: boolean;
  is_admin?: boolean;
  is_superuser?: boolean;
  can_assign?: boolean;
}

export interface UserPermissions {
  can_accept?: boolean;
  can_process?: boolean;
  can_assign?: boolean;
  can_report?: boolean;
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
