import { WorkspaceFrame } from "@/app/layouts/workspace-frame";
import { useSidebarPreferences } from "@/app/layouts/use-sidebar-preferences";
import {
  WorkspaceSkeleton,
  WorkspaceHeaderSkeleton,
  WorkspaceSidebarSkeleton,
} from "@/components/workspace-skeleton";

export function LoadingScreen() {
  const { collapsed } = useSidebarPreferences();
  return (
    <WorkspaceFrame
      busy
      sidebarCollapsed={collapsed}
      header={<WorkspaceHeaderSkeleton />}
      sidebar={<WorkspaceSidebarSkeleton collapsed={collapsed} />}
    >
      <WorkspaceSkeleton />
    </WorkspaceFrame>
  );
}
