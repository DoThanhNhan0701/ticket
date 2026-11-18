import { WorkspaceHeader } from "@/app/layouts/workspace-header";
import { WorkspaceFrame } from "@/app/layouts/workspace-frame";
import { useSidebarPreferences } from "@/app/layouts/use-sidebar-preferences";
import {
  WorkspaceSkeleton,
  WorkspaceSidebarSkeleton,
} from "@/components/workspace-skeleton";

export function LoadingScreen() {
  const { collapsed } = useSidebarPreferences();
  return (
    <WorkspaceFrame
      busy
      sidebarCollapsed={collapsed}
      header={<WorkspaceHeader loading />}
      sidebar={<WorkspaceSidebarSkeleton collapsed={collapsed} />}
    >
      <WorkspaceSkeleton />
    </WorkspaceFrame>
  );
}
