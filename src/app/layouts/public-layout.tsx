import { Navigate, Outlet } from "react-router-dom";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { LoadingScreen } from "@/components/loading-screen";

export function PublicLayout() {
  const { token, isInitializing } = useAuthContext();

  if (isInitializing) {
    return <LoadingScreen />;
  }

  return token ? <Navigate to="/" replace /> : <Outlet />;
}
