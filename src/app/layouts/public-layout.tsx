import { Navigate, Outlet } from "react-router-dom";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { LoadingScreen } from "@/components/loading-screen";
import { getDefaultWorkspacePath } from "../navigation";

export function PublicLayout() {
  const { token, isInitializing, permissions } = useAuthContext();

  if (isInitializing) {
    return <LoadingScreen />;
  }

  return token ? (
    <Navigate to={getDefaultWorkspacePath(permissions)} replace />
  ) : (
    <Outlet />
  );
}
