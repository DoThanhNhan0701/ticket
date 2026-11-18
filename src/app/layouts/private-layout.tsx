import { useLocale } from "@/i18n";
import { Suspense, useRef } from "react";
import { Outlet } from "react-router-dom";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { HomepageRedirect } from "../homepage-redirect";
import { AppSidebar, MobileSidebar } from "./app-sidebar";
import { useSidebarPreferences } from "./use-sidebar-preferences";
import { WorkspaceFrame } from "./workspace-frame";
import { WorkspaceHeader } from "./workspace-header";
import {
  WorkspaceSkeleton,
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
        <WorkspaceHeader
          loading={isInitializing}
          mobileNavigation={
            <MobileSidebar
              desktopToggleRef={desktopToggleRef}
              groupsOpen={groups}
              onGroupToggle={toggleGroup}
            />
          }
        />
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
