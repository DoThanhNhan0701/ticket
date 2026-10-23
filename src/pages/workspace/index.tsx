import { interviewCalendarBackLink } from "@/features/recruitment/utils/interview-navigation";
import { APP_ROUTES } from "@/constants/routes";
import { MobilePageActionProvider } from "@/components/layout/mobile-page-action";
import { Link, Navigate, useSearchParams, useNavigate } from "react-router-dom";
import { LegacyPageRedirect } from "@/app/legacy-page-redirect";
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
import { RequestCreate } from "@/features/requests/components/request-create";
import { RequestDetail } from "@/features/requests/components/request-detail";
import type { RequestListScope } from "@/features/requests/types";
import { SettingsList } from "@/features/settings/components/settings-list";
import { getSettingsKind } from "@/features/settings/utils/settings-config";
import { ReportsPage } from "@/features/reports/components/reports-page";
import { RecruitmentList } from "@/features/recruitment/components/recruitment-list";
import { RecruitmentCalendar } from "@/features/recruitment/components/recruitment-calendar";
import { RecruitmentReport } from "@/features/recruitment/components/recruitment-report";
import { InterviewCandidates } from "@/features/recruitment/components/interview-candidates";

const requestListScopesByPath: Readonly<
  Partial<Record<string, RequestListScope>>
> = {
  [HOME_PATH]: "created",
  [APP_ROUTES.requests.all]: "all",
  [APP_ROUTES.approvals.pending]: "pending",
  [APP_ROUTES.approvals.approved]: "approved",
  [APP_ROUTES.tasks.mine]: "personal-tasks",
  [APP_ROUTES.tasks.all]: "all-tasks",
};

export function WorkspacePage({
  page,
}: Readonly<{ page: WorkspacePageDefinition }>) {
  const { permissions, userId } = useAuthContext();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const backActionsByPath: Partial<Record<string, () => void>> = {
    [APP_ROUTES.recruitment.interviewDetail]: () =>
      navigate(interviewCalendarBackLink(params)),
  };
  const allowed = canAccessPage(page, permissions);
  if (!allowed) return <Navigate to={APP_ROUTES.forbidden} replace />;
  if (page.path === APP_ROUTES.requests.detail && allowed)
    return <RequestDetail key={userId} />;
  const Icon = page.icon;
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
  if (page.path === APP_ROUTES.requests.changeStatus)
    content = <RequestChangeStatus />;
  if (page.path === APP_ROUTES.requests.create)
    content = (
      <RequestCreate key={`${userId}:${params.get("clone") ?? "new"}`} />
    );
  if (page.path === APP_ROUTES.reports.overview)
    content = <ReportsPage key="report-dashboard" />;
  if (page.path === APP_ROUTES.reports.export)
    content = <ReportsPage key="report-export" mode="export" />;
  if (page.path === APP_ROUTES.recruitment.requests)
    content = (
      <RecruitmentList key={`recruitment-requests-${userId}`} kind="requests" />
    );
  if (page.path === APP_ROUTES.recruitment.candidates)
    content = (
      <RecruitmentList
        key={`recruitment-candidates-${userId}`}
        kind="candidates"
      />
    );
  if (page.path === APP_ROUTES.recruitment.interviews)
    content = <RecruitmentCalendar key={`recruitment-calendar-${userId}`} />;
  if (page.path === APP_ROUTES.recruitment.reports)
    content = <RecruitmentReport key={`recruitment-reports-${userId}`} />;
  if (page.path === APP_ROUTES.recruitment.interviewDetail)
    content = <InterviewCandidates key={`recruitment-interview-${userId}`} />;

  if (page.path === APP_ROUTES.settings.overview)
    content = <LegacyPageRedirect to={APP_ROUTES.settings.users} />;
  const settingsKind = getSettingsKind(page.path);
  if (settingsKind)
    content = (
      <SettingsList key={`${settingsKind}-${userId}`} kind={settingsKind} />
    );
  if (page.path === APP_ROUTES.settings.createUser)
    content = (
      <SettingsList key={`create-user-${userId}`} kind="users" createUser />
    );

  return (
    <MobilePageActionProvider>
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-3">
        <PageHeader
          title={page.label}
          description={page.description}
          icon={Icon}
          onBack={backActionsByPath[page.path]}
          backLabel="Quay lại lịch phỏng vấn"
          actions={
            page.path === HOME_PATH &&
            canAccessPage(createTicketPage, permissions) ? (
              <Link
                to={createTicketPage.path}
                title={createTicketPage.label}
                className={buttonVariants({
                  className: "max-sm:size-11 max-sm:gap-0 max-sm:px-0",
                })}
              >
                <createTicketPage.icon className="size-4" aria-hidden="true" />
                <span className="max-sm:sr-only">{createTicketPage.label}</span>
              </Link>
            ) : undefined
          }
        />
        {content}
      </div>
    </MobilePageActionProvider>
  );
}
