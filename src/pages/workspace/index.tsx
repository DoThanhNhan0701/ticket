import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import {
  canAccessPage,
  createTicketPage,
  type WorkspacePageDefinition,
} from "@/app/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { HOME_PATH } from "@/constants/auth";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { RequestList } from "@/features/requests/components/request-list";
import { RequestChangeStatus } from "@/features/requests/components/request-change-status";
import type { RequestListScope } from "@/features/requests/types";

const requestListScopesByPath: Readonly<
  Partial<Record<string, RequestListScope>>
> = {
  [HOME_PATH]: "created",
  "/requests/all": "all",
  "/approvals/pending": "pending",
  "/approvals/approved": "approved",
};

export function WorkspacePage({
  page,
}: Readonly<{ page: WorkspacePageDefinition }>) {
  const { permissions } = useAuthContext();
  const Icon = page.icon;
  const allowed = canAccessPage(page, permissions);
  let content = (
    <EmptyState
      title="Trang đang được chuẩn bị"
      description="Chức năng này đang được hoàn thiện. Bạn có thể chọn mục khác trong thanh điều hướng."
      icon={<Icon className="size-6" aria-hidden="true" />}
      className="my-auto min-h-72"
    />
  );
  const listScope = requestListScopesByPath[page.path];
  if (listScope) content = <RequestList key={listScope} scope={listScope} />;
  if (page.path === "/requests/change-status")
    content = <RequestChangeStatus />;

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-3">
      <PageHeader
        title={page.label}
        description={page.description}
        icon={Icon}
        actions={
          page.path === HOME_PATH &&
          canAccessPage(createTicketPage, permissions) ? (
            <Link to={createTicketPage.path} className={buttonVariants()}>
              <createTicketPage.icon className="size-4" aria-hidden="true" />
              {createTicketPage.label}
            </Link>
          ) : undefined
        }
      />
      {allowed ? (
        content
      ) : (
        <EmptyState
          title="Bạn chưa có quyền truy cập"
          description="Vui lòng liên hệ quản trị viên nếu bạn cần sử dụng chức năng này."
          icon={<ShieldCheck className="size-6" aria-hidden="true" />}
          className="my-auto min-h-72"
        />
      )}
    </div>
  );
}
