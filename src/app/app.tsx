import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { LoadingScreen } from "@/components/loading-screen";
import { PrivateLayout } from "@/app/layouts/private-layout";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PublicLayout } from "./layouts/public-layout";

const LoginPage = lazy(() =>
  import("@/pages/login").then((m) => ({ default: m.LoginPage })),
);
const TicketPage = lazy(() =>
  import("@/pages/ticket").then((m) => ({ default: m.TicketPage })),
);

export default function App() {
  const auth = useAuthContext();

  return (
    <Suspense fallback={<LoadingScreen />}>
      <TooltipProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route
              path="/login"
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
            <Route path="/" element={<TicketPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </TooltipProvider>
    </Suspense>
  );
}
