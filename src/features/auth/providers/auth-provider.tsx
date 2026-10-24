import { t, useLocale } from "@/i18n";
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
  AUTH_ACCESS_DENIED_EVENT,
  STORAGE_AUTH_ENVIRONMENT_KEY,
} from "@/constants";
import {
  clearAuthSession,
  getAuthSessionVersion,
  startAuthSession,
} from "@/lib/auth-session";
import { ApiError } from "@/lib/api/api-error";
import { getAuthEnvironment } from "@/lib/auth-environment";
import { AuthContext } from "../context/auth-context";
import { cachedUserPermissionSchema } from "../schemas/account-schema";

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  useLocale();
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [userPermission, setUserPermission] =
    useState<UserPermissionResponse | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
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
    setStorageItem(STORAGE_AUTH_ENVIRONMENT_KEY, getAuthEnvironment());
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
        if (getAuthSessionVersion() !== version) return null;
        // A successful but incompatible account response is not proof that
        // permissions cached for this API/environment are still valid.
        if (
          err instanceof Error &&
          !(err instanceof ApiError) &&
          !(err instanceof TypeError)
        )
          window.dispatchEvent(new Event(AUTH_ACCESS_DENIED_EVENT));
        console.error(t("login", "Failed to fetch user permissions:"), err);
        return null;
      }
    };

  useEffect(() => {
    const denyAccess = () => {
      setAccessDenied(true);
      setToken(null);
      setUsername("");
      setUserPermission(null);
      if (getCookie(COOKIE_TOKEN_KEY) || getCookie(COOKIE_REFRESH_KEY))
        clearAuthSession();
      queryClient.clear();
    };
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
    window.addEventListener(AUTH_ACCESS_DENIED_EVENT, denyAccess);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, syncSession);
      window.removeEventListener(AUTH_ACCESS_DENIED_EVENT, denyAccess);
    };
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
        const environment = getStorageItem<unknown>(
          STORAGE_AUTH_ENVIRONMENT_KEY,
        );
        if (environment && environment !== getAuthEnvironment()) {
          clearAuthSession();
          queryClient.clear();
          setAccessDenied(true);
          setIsInitializing(false);
          return;
        }
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
        throw new ApiError(
          t("login", "Sign-in was cancelled. Please try again."),
          409,
        );
      }
      const version = startAuthSession(tokens);

      try {
        const permission = await getUserPermissionRequest();
        if (getAuthSessionVersion() !== version) {
          throw new ApiError(
            t("login", "Sign-in was cancelled. Please try again."),
            409,
          );
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
      setAccessDenied(false);
      setToken(access);

      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setAccessDenied(false);
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
        accessDenied,
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
