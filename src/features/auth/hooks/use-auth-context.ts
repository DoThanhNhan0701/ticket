import { t } from "@/i18n";
import { useContext } from "react";
import {
  AuthContext,
  AuthContextValue,
} from "@/features/auth/context/auth-context";

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      t("login", "useAuthContext must be used within AuthProvider"),
    );
  }
  return ctx;
}
