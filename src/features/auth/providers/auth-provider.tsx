import { useState, useEffect, useRef, ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import {
  loginRequest,
  getUserPermissionRequest,
} from "@/features/auth/api/auth-api";
import type { UserPermissionResponse } from "@/features/auth/types";
import { getCookie, setCookie } from "@/lib/cookies";
import { getStorageItem, setStorageItem } from "@/lib/storage";
import {
  COOKIE_TOKEN_KEY,
  COOKIE_REFRESH_KEY,
  STORAGE_USERNAME_KEY,
  STORAGE_USER_PERMISSION_KEY,
} from "@/constants";
import { clearAuthSession } from "@/lib/auth-session";
import { AuthContext } from "../context/auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [userPermission, setUserPermission] =
    useState<UserPermissionResponse | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const isInitializedRef = useRef(false);

  const resetAuthState = () => {
    setToken(null);
    setUsername("");
    setUserPermission(null);
    clearAuthSession();
  };

  const applyUserPermission = (permission: UserPermissionResponse) => {
    setUserPermission(permission);
    setUsername(permission.username);
    setStorageItem(STORAGE_USER_PERMISSION_KEY, permission);
    setStorageItem(STORAGE_USERNAME_KEY, permission.username);
  };

  const fetchUserPermission =
    async (): Promise<UserPermissionResponse | null> => {
      try {
        const permData = await getUserPermissionRequest();
        applyUserPermission(permData);
        return permData;
      } catch (err) {
        resetAuthState();
        console.error("Failed to fetch user permissions:", err);
        return null;
      }
    };

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initAuth = async () => {
      const savedToken = getCookie(COOKIE_TOKEN_KEY);
      const savedUsername = getStorageItem<string>(STORAGE_USERNAME_KEY);
      const savedPermission = getStorageItem<UserPermissionResponse>(
        STORAGE_USER_PERMISSION_KEY,
      );

      if (savedToken) {
        setToken(savedToken);
        if (savedUsername) setUsername(savedUsername);
        if (savedPermission) setUserPermission(savedPermission);

        // Refresh the Ticket account and permissions on page reload.
        await fetchUserPermission();
      } else {
        clearAuthSession();
      }
      setIsInitializing(false);
    };

    initAuth();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (vars: { username: string; password: string }) => {
      const tokens = await loginRequest(vars.username, vars.password);
      setCookie(COOKIE_TOKEN_KEY, tokens.access);
      setCookie(COOKIE_REFRESH_KEY, tokens.refresh);

      try {
        const permission = await getUserPermissionRequest();
        return { tokens, permission };
      } catch (error) {
        clearAuthSession();
        throw error;
      }
    },
  });

  const login = async (userVal: string, passVal: string): Promise<boolean> => {
    try {
      const { tokens, permission } = await loginMutation.mutateAsync({
        username: userVal.trim(),
        password: passVal,
      });

      applyUserPermission(permission);
      setToken(tokens.access);

      return true;
    } catch {
      resetAuthState();
      return false;
    }
  };

  const logout = () => {
    resetAuthState();
    loginMutation.reset();
    queryClient.clear();
  };

  const setError = (msg: string | null) => {
    if (msg === null) loginMutation.reset();
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        username,
        userId: userPermission?.userId ?? null,
        avatarUrl: userPermission?.avatar_url ?? null,
        permissions: userPermission?.permission ?? null,
        userPermission,
        isInitializing,
        isLoading: loginMutation.isPending,
        error: loginMutation.error?.message ?? null,
        login,
        logout,
        setError,
        refreshUserPermission: fetchUserPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
