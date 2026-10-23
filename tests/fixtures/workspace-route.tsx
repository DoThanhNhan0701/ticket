import { useLocation } from "react-router-dom";
import type { WorkspacePageDefinition } from "@/app/navigation";
import { APP_ROUTES } from "@/constants/routes";
import { ForbiddenPage } from "@/pages/forbidden";
import { WorkspacePage } from "@/pages/workspace";

// Isolated page tests still need to follow the same denied route as App.
export function WorkspaceRoute({
  page,
}: Readonly<{ page?: WorkspacePageDefinition }>) {
  const location = useLocation();
  if (location.pathname === APP_ROUTES.forbidden) return <ForbiddenPage />;
  return page ? <WorkspacePage page={page} /> : null;
}
