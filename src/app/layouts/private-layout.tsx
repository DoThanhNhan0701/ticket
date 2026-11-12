import { t, useLocale } from "@/i18n";
import { APP_ROUTES } from "@/constants/routes";
import { Suspense, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { BookOpen, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitch } from "@/components/language-switch";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { HomepageRedirect } from "../homepage-redirect";
import { AppSidebar, MobileSidebar } from "./app-sidebar";
import { useSidebarPreferences } from "./use-sidebar-preferences";
import { WorkspaceFrame } from "./workspace-frame";
import {
  WorkspaceSkeleton,
  WorkspaceHeaderSkeleton,
  WorkspaceSidebarSkeleton,
} from "@/components/workspace-skeleton";

export function PrivateLayout() {
  useLocale();
  const navigate = useNavigate();
  const {
    collapsed: sidebarCollapsed,
    groups,
    toggleCollapsed,
    toggleGroup,
  } = useSidebarPreferences();
  const desktopToggleRef = useRef<HTMLButtonElement>(null);
  const { token, isInitializing, username, avatarUrl, logout } =
    useAuthContext();
  if (!isInitializing && !token) return <HomepageRedirect />;

  return (
    <WorkspaceFrame
      sidebarCollapsed={sidebarCollapsed}
      busy={isInitializing}
      header={
        isInitializing ? (
          <WorkspaceHeaderSkeleton />
        ) : (
          <>
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
                    sidebarCollapsed
                      ? t("layout", "Mở rộng sidebar")
                      : t("layout", "Thu gọn sidebar")
                  }
                  title={
                    sidebarCollapsed
                      ? t("layout", "Mở rộng sidebar")
                      : t("layout", "Thu gọn sidebar")
                  }
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
              <a
                href={import.meta.env.VITE_HOMEPAGE_URL}
                aria-label={t("layout", "Rainscales Ticket home")}
                className="shrink-0 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <BrandLogo variant="mark" className="size-8 sm:hidden" />
                <BrandLogo className="hidden h-7 w-[clamp(5.5rem,calc(100vw-16rem),10rem)] sm:inline-block" />
              </a>
              <div className="hidden min-w-0 items-center gap-2 border-l border-border pl-2 sm:flex">
                <UserAvatar
                  name={username}
                  src={avatarUrl}
                  className="h-8 w-8"
                />
                <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
                  {username}
                </span>
              </div>
            </div>
            <nav
              aria-label={t("layout", "Main navigation")}
              className="flex shrink-0 items-center gap-1 sm:gap-2"
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void navigate(APP_ROUTES.help)}
                aria-label={t("layout", "Hướng dẫn sử dụng")}
                title={t("layout", "Hướng dẫn sử dụng")}
                className="size-11 shrink-0 rounded-md border-border bg-card text-foreground hover:bg-accent sm:size-9 sm:pointer-coarse:size-11"
              >
                <BookOpen className="size-4" aria-hidden="true" />
              </Button>
              <LanguageSwitch />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={logout}
                aria-label={t("layout", "Sign Out")}
                title={t("layout", "Sign Out")}
                className="h-11 w-11 shrink-0 gap-1.5 px-0 text-[0.8rem] sm:h-9 sm:w-9 sm:pointer-coarse:h-11 sm:pointer-coarse:min-w-11 lg:w-28 lg:px-3"
              >
                <LogOut className="size-3.5" />
                <span className="hidden lg:inline">
                  {t("layout", "Sign Out")}
                </span>
              </Button>
            </nav>
          </>
        )
      }
      sidebar={
        isInitializing ? (
          <WorkspaceSidebarSkeleton collapsed={sidebarCollapsed} />
        ) : (
          <AppSidebar
            collapsed={sidebarCollapsed}
            groupsOpen={groups}
            onGroupToggle={toggleGroup}
          />
        )
      }
    >
      {isInitializing ? (
        <WorkspaceSkeleton />
      ) : (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <Outlet />
        </Suspense>
      )}
    </WorkspaceFrame>
  );
}
