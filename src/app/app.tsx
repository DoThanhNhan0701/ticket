import { APP_ROUTES } from "@/constants/routes";
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { LoadingScreen } from "@/components/loading-screen";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { PrivateLayout } from "@/app/layouts/private-layout";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PublicLayout } from "./layouts/public-layout";
import { workspacePages, getDefaultWorkspacePath } from "./navigation";
import { LegacyPageRedirect } from "./legacy-page-redirect";

const LoginPage = lazy(() =>
  import("@/pages/login").then((m) => ({ default: m.LoginPage })),
);
const WorkspacePage = lazy(() =>
  import("@/pages/workspace").then((m) => ({ default: m.WorkspacePage })),
);
const UserGuidePage = lazy(() =>
  import("@/pages/help").then((m) => ({ default: m.UserGuidePage })),
);

export default function App() {
  const auth = useAuthContext();
  const homeRedirect = auth.isInitializing ? (
    <LoadingScreen />
  ) : (
    <Navigate to={getDefaultWorkspacePath(auth.permissions)} replace />
  );

  return (
    <AppErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <TooltipProvider>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route
                path={APP_ROUTES.login}
                element={
                  <LoginPage
                    onLogin={auth.login}
                    isLoading={auth.isLoading}
                    error={auth.error}
                    setError={auth.setError}
                  />
                }
              />
            </Route>

            <Route element={<PrivateLayout />}>
              <Route path={APP_ROUTES.root} element={homeRedirect} />
              <Route path={APP_ROUTES.help} element={<UserGuidePage />} />
              {workspacePages.map((page) => (
                <Route
                  key={page.path}
                  path={page.path}
                  element={<WorkspacePage page={page} />}
                />
              ))}
              {workspacePages.flatMap((page) =>
                (page.legacyPaths ?? []).map((path) => (
                  <Route
                    key={path}
                    path={path}
                    element={<LegacyPageRedirect to={page.path} />}
                  />
                )),
              )}
            </Route>

            <Route path={APP_ROUTES.notFound} element={homeRedirect} />
          </Routes>
          <Toaster position="top-right" />
        </TooltipProvider>
      </Suspense>
    </AppErrorBoundary>
  );
}
