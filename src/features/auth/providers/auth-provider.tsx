import { useState, useEffect, useRef, ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import {
  loginRequest,
  getUserPermissionRequest,
} from "@/features/auth/api/auth-api";
import type { UserPermissionResponse } from "@/features/auth/types";
import { getCookie } from "@/lib/cookies";
import { getStorageItem, setStorageItem } from "@/lib/storage";
import {
  COOKIE_TOKEN_KEY,
  COOKIE_REFRESH_KEY,
  STORAGE_USERNAME_KEY,
  STORAGE_USER_PERMISSION_KEY,
  AUTH_SESSION_CHANGED_EVENT,
} from "@/constants";
import {
  clearAuthSession,
  getAuthSessionVersion,
  startAuthSession,
} from "@/lib/auth-session";
import { ApiError } from "@/lib/api/api-error";
import { AuthContext } from "../context/auth-context";
import { cachedUserPermissionSchema } from "../schemas/account-schema";

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
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
      const version = getAuthSessionVersion();
      try {
        const permData = await getUserPermissionRequest();
        if (getAuthSessionVersion() !== version) return null;
        applyUserPermission(permData);
        return permData;
      } catch (err) {
        console.error("Failed to fetch user permissions:", err);
        return null;
      }
    };

  useEffect(() => {
    const syncSession = () => {
      const savedToken = getCookie(COOKIE_TOKEN_KEY);
      // A new sign-in still needs to finish loading its account information.
      setToken((current) => (current ? (savedToken ?? null) : null));
      if (!savedToken) {
        setUsername("");
        setUserPermission(null);
      }
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, syncSession);
    return () =>
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, syncSession);
  }, []);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initAuth = async () => {
      const savedToken = getCookie(COOKIE_TOKEN_KEY);
      const savedRefresh = getCookie(COOKIE_REFRESH_KEY);
      const savedUsername = getStorageItem<unknown>(STORAGE_USERNAME_KEY);
      const savedPermission = cachedUserPermissionSchema.safeParse(
        getStorageItem<unknown>(STORAGE_USER_PERMISSION_KEY),
      );

      if (savedToken || savedRefresh) {
        setToken(savedToken ?? null);
        if (typeof savedUsername === "string") setUsername(savedUsername);
        if (savedPermission.success) setUserPermission(savedPermission.data);

        // Refresh the Ticket account and permissions on page reload.
        await fetchUserPermission();
        setToken(getCookie(COOKIE_TOKEN_KEY) ?? null);
      } else {
        clearAuthSession();
      }
      setIsInitializing(false);
    };

    initAuth();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (vars: {
      username: string;
      password: string;
      version: number;
    }) => {
      const tokens = await loginRequest(vars.username, vars.password);
      if (getAuthSessionVersion() !== vars.version) {
        throw new ApiError("Sign-in was cancelled. Please try again.", 409);
      }
      const version = startAuthSession(tokens);

      try {
        const permission = await getUserPermissionRequest();
        if (getAuthSessionVersion() !== version) {
          throw new ApiError("Sign-in was cancelled. Please try again.", 409);
        }
        return {
          access: getCookie(COOKIE_TOKEN_KEY) ?? tokens.access,
          permission,
        };
      } catch (error) {
        if (getAuthSessionVersion() === version) clearAuthSession();
        throw error;
      }
    },
  });

  const login = async (userVal: string, passVal: string): Promise<boolean> => {
    try {
      const { access, permission } = await loginMutation.mutateAsync({
        username: userVal.trim(),
        password: passVal,
        version: getAuthSessionVersion(),
      });

      applyUserPermission(permission);
      setToken(access);

      return true;
    } catch {
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
