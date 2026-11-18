import { useLocation } from "react-router-dom";
import {
  canAccessPage,
  createTicketPage,
  getDefaultWorkspacePath,
  workspacePages,
} from "@/app/navigation";
import { HOME_PATH } from "@/constants/auth";
import { APP_ROUTES } from "@/constants/routes";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { requestListScopesByPath } from "@/features/requests/utils/request-list-config";
import { t, useLocale } from "@/i18n";
import {
  DataResultsSkeleton,
  DataSearchSkeleton,
  dataResultsClassName,
} from "./data-management/data-results-skeleton";
import { PageHeaderSkeleton } from "./layout/page-header-skeleton";

export function WorkspaceSkeleton() {
  useLocale();
  const { pathname } = useLocation();
  const { permissions } = useAuthContext();
  const route =
    pathname === APP_ROUTES.root
      ? getDefaultWorkspacePath(permissions)
      : pathname.replace(/\/+$/, "").toLowerCase();
  const page = workspacePages.find(
    (item) =>
      item.path === route ||
      item.legacyPaths?.some((path) => path.toLowerCase() === route),
  );
  const listPath = page?.path ?? route;
  const listScope = requestListScopesByPath[listPath];
  const showCreate =
    listPath === HOME_PATH && canAccessPage(createTicketPage, permissions);

  return (
    <div
      role="status"
      aria-label={t("common", "Loading...")}
      data-workspace-loading=""
      className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-3"
    >
      <PageHeaderSkeleton
        actions={
          <>
            {listScope && (
              <div className="size-11 rounded-lg bg-(--workspace-skeleton-soft) sm:hidden" />
            )}
            {showCreate && (
              <div className="size-11 rounded-lg bg-(--workspace-skeleton-fill) sm:h-10 sm:w-32" />
            )}
          </>
        }
      />
      {listScope && (
        <div
          aria-hidden="true"
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
        >
          <DataSearchSkeleton />
          <div className={dataResultsClassName}>
            <DataResultsSkeleton />
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkspaceSidebarSkeleton({
  collapsed = false,
}: Readonly<{ collapsed?: boolean }>) {
  return (
    <div aria-hidden="true" className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-3 pt-3 pb-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-3 rounded-lg px-2"
          >
            <div className="size-5 shrink-0 rounded bg-(--workspace-skeleton-fill)" />
            {!collapsed && (
              <div className="h-3 flex-1 rounded bg-(--workspace-skeleton-soft)" />
            )}
          </div>
        ))}
      </div>
      <div className="flex h-[69px] shrink-0 items-center justify-center border-t border-sidebar-border">
        <div className="size-4 rounded bg-(--workspace-skeleton-fill)" />
      </div>
    </div>
  );
}
