import { APP_ROUTES } from "@/constants/routes";
import { useRef } from "react";
import { Link, Navigate, Outlet, useNavigate } from "react-router-dom";
import { BookOpen, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoadingScreen } from "@/components/loading-screen";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDefaultWorkspacePath } from "../navigation";
import { AppSidebar, MobileSidebar } from "./app-sidebar";
import { useSidebarPreferences } from "./use-sidebar-preferences";

export function PrivateLayout() {
  const navigate = useNavigate();
  const {
    collapsed: sidebarCollapsed,
    groups,
    toggleCollapsed,
    toggleGroup,
  } = useSidebarPreferences();
  const desktopToggleRef = useRef<HTMLButtonElement>(null);
  const { token, isInitializing, username, avatarUrl, logout, permissions } =
    useAuthContext();
  if (isInitializing) return <LoadingScreen />;
  if (!token) return <Navigate to={APP_ROUTES.login} replace />;

  return (
    <div className="app-dashed-background flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="h-16 shrink-0 border-b border-border bg-card">
        <div className="flex h-full items-center justify-between gap-2 px-[clamp(0.75rem,2vw,1.5rem)] lg:pl-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-11 shrink-0 items-center justify-center">
              <MobileSidebar
                desktopToggleRef={desktopToggleRef}
                groupsOpen={groups}
                onGroupToggle={toggleGroup}
              />
              <Button
                ref={desktopToggleRef}
                variant="outline"
                size="icon"
                className="hidden size-11 lg:inline-flex"
                aria-label={
                  sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"
                }
                title={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
                aria-expanded={!sidebarCollapsed}
                aria-controls="desktop-sidebar"
                onClick={toggleCollapsed}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="size-4" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
            <Link
              to={getDefaultWorkspacePath(permissions)}
              aria-label="Rainscales Ticket home"
              className="shrink-0 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <BrandLogo variant="mark" className="size-8 sm:hidden" />
              <BrandLogo className="hidden h-7 w-[clamp(5.5rem,calc(100vw-16rem),10rem)] sm:inline-block" />
            </Link>
            <div className="flex min-w-0 items-center gap-2 border-l border-border pl-2">
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
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void navigate(APP_ROUTES.help)}
              aria-label="Hướng dẫn sử dụng"
              title="Hướng dẫn sử dụng"
              className="size-11 shrink-0 rounded-md border-border bg-card text-foreground hover:bg-accent sm:size-9 sm:pointer-coarse:size-11"
            >
              <BookOpen className="size-4" aria-hidden="true" />
            </Button>
            <ThemeToggle />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={logout}
              aria-label="Sign Out"
              title="Sign Out"
              className="h-11 w-11 gap-1.5 px-0 text-[0.8rem] sm:h-9 sm:w-9 sm:pointer-coarse:h-11 sm:pointer-coarse:min-w-11 lg:w-auto lg:px-3"
            >
              <LogOut className="size-3.5" />
              <span className="hidden lg:inline">Sign Out</span>
            </Button>
          </nav>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside
          id="desktop-sidebar"
          aria-label="Sidebar Ticket"
          className={cn(
            "hidden min-h-0 shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 motion-reduce:transition-none lg:block",
            sidebarCollapsed ? "w-18" : "w-72",
          )}
        >
          <AppSidebar
            collapsed={sidebarCollapsed}
            groupsOpen={groups}
            onGroupToggle={toggleGroup}
          />
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-3 sm:p-6">
          <div className="flex h-full min-h-full min-w-0 w-full flex-1 flex-col">
            <Outlet />
          </div>
        </main>
      </div>
      <footer className="shrink-0 border-t border-border bg-card px-3 py-2 text-center text-xs text-muted-foreground">
        © 2026 Rainscales · Ticket
      </footer>
    </div>
  );
}
