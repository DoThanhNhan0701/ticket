import { Link, Navigate, Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoadingScreen } from "@/components/loading-screen";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";

export function PrivateLayout() {
  const { token, isInitializing, username, avatarUrl, logout } =
    useAuthContext();
  if (isInitializing) return <LoadingScreen />;
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="app-dashed-background flex h-dvh min-h-0 flex-col bg-background text-foreground">
      <header className="h-16 shrink-0 border-b border-border bg-card">
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-2 px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-5">
            <Link
              to="/"
              aria-label="Rainscales Ticket home"
              className="shrink-0 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <BrandLogo variant="mark" className="sm:hidden" />
              <BrandLogo className="hidden h-7 w-40 sm:inline-block" />
            </Link>
            <div className="flex min-w-0 items-center gap-2 border-l border-border pl-2 sm:pl-5">
              <UserAvatar name={username} src={avatarUrl} className="h-8 w-8" />
              <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
                {username}
              </span>
            </div>
          </div>
          <nav
            aria-label="Main navigation"
            className="flex shrink-0 items-center gap-1 sm:gap-2"
          >
            <ThemeToggle />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={logout}
              aria-label="Sign Out"
              title="Sign Out"
              className="h-9 w-9 gap-1.5 px-0 text-[0.8rem] lg:w-auto lg:px-3"
            >
              <LogOut className="size-3.5" />
              <span className="hidden lg:inline">Sign Out</span>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-y-auto p-3 sm:p-6">
        <Outlet />
      </main>
      <footer className="shrink-0 border-t border-border bg-card px-3 py-2 text-center text-xs text-muted-foreground">
        © 2026 Rainscales · Ticket
      </footer>
    </div>
  );
}
