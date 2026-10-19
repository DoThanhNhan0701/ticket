import { createContext } from "react";
import { UserPermissions, UserPermissionResponse } from "@/features/auth/types";

export interface AuthContextValue {
  token: string | null;
  username: string;
  userId: number | null;
  avatarUrl: string | null;
  permissions: UserPermissions | null;
  userPermission: UserPermissionResponse | null;
  isInitializing: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  setError: (error: string | null) => void;
  refreshUserPermission: () => Promise<UserPermissionResponse | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
