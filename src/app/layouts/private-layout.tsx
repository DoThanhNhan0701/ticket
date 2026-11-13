import { t, useLocale } from "@/i18n";
import { Suspense, useRef } from "react";
import { Outlet } from "react-router-dom";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { BrandLogo } from "@/components/brand-logo";
import { HomepageRedirect } from "../homepage-redirect";
import { AppSidebar, MobileSidebar } from "./app-sidebar";
import { useSidebarPreferences } from "./use-sidebar-preferences";
import { WorkspaceFrame } from "./workspace-frame";
import { AccountMenu } from "./account-menu";
import {
  WorkspaceSkeleton,
  WorkspaceHeaderSkeleton,
  WorkspaceSidebarSkeleton,
} from "@/components/workspace-skeleton";

export function PrivateLayout() {
  useLocale();
  const {
    collapsed: sidebarCollapsed,
    groups,
    toggleCollapsed,
    toggleGroup,
  } = useSidebarPreferences();
  const desktopToggleRef = useRef<HTMLButtonElement>(null);
  const { token, isInitializing } = useAuthContext();
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
              <div className="flex size-11 shrink-0 items-center justify-center lg:hidden">
                <MobileSidebar
                  desktopToggleRef={desktopToggleRef}
                  groupsOpen={groups}
                  onGroupToggle={toggleGroup}
                />
              </div>
              <a
                href={import.meta.env.VITE_HOMEPAGE_URL}
                aria-label={t("layout", "Rainscales Ticket home")}
                className="shrink-0 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <BrandLogo variant="mark" className="size-8 sm:hidden" />
                <BrandLogo className="hidden h-7 w-[clamp(5.5rem,calc(100vw-16rem),10rem)] sm:inline-block" />
              </a>
            </div>
            <AccountMenu />
          </>
        )
      }
      sidebar={
        isInitializing ? (
          <WorkspaceSidebarSkeleton collapsed={sidebarCollapsed} />
        ) : (
          <AppSidebar
            collapsed={sidebarCollapsed}
            collapseButtonRef={desktopToggleRef}
            onToggleCollapsed={toggleCollapsed}
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
