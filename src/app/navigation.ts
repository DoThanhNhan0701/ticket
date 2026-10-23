import { APP_ROUTES } from "@/constants/routes";
import {
  ArrowLeftRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCheck,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Database,
  FileChartColumn,
  FileText,
  FolderKanban,
  Inbox,
  ListChecks,
  ListFilter,
  Plus,
  Settings,
  Tags,
  Ticket,
  UserPlus,
  UserRoundCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { UserPermissions } from "@/features/auth/types";
import { matchPath } from "react-router-dom";
import { HOME_PATH } from "@/constants/auth";

export type PagePermission =
  | "can_view"
  | "can_create"
  | "can_allticket"
  | "can_return_ticket"
  | "can_accept"
  | "can_process"
  | "can_report"
  | "can_export"
  | "can_hr_rec"
  | "can_cv_interview"
  | "can_system";

export interface WorkspacePageDefinition {
  path: string;
  legacyPaths?: readonly string[];
  label: string;
  description: string;
  icon: LucideIcon;
  permission: PagePermission;
  activePaths?: readonly string[];
}

export interface NavigationGroup {
  label: string;
  icon: LucideIcon;
  pages: WorkspacePageDefinition[];
}

export const createTicketPage: WorkspacePageDefinition = {
  path: APP_ROUTES.requests.create,
  legacyPaths: [APP_ROUTES.legacy.createRequest],
  label: "Tạo yêu cầu",
  description: "Tạo yêu cầu hỗ trợ và gửi đến bộ phận phụ trách.",
  icon: Plus,
  permission: "can_create",
};

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Yêu cầu",
    icon: Ticket,
    pages: [
      {
        path: HOME_PATH,
        legacyPaths: [APP_ROUTES.legacy.requests],
        label: "Danh sách yêu cầu",
        description: "Theo dõi các yêu cầu bạn đã gửi.",
        icon: Inbox,
        permission: "can_view",
        activePaths: [
          APP_ROUTES.requests.detail,
          APP_ROUTES.requests.fromEmail,
        ],
      },
      {
        path: APP_ROUTES.requests.all,
        legacyPaths: [APP_ROUTES.legacy.allRequests],
        label: "Tất cả yêu cầu",
        description: "Tra cứu yêu cầu trên toàn hệ thống.",
        icon: ListFilter,
        permission: "can_allticket",
      },
      {
        path: APP_ROUTES.requests.changeStatus,
        legacyPaths: [APP_ROUTES.legacy.changeStatus],
        label: "Chuyển trạng thái yêu cầu",
        description: "Quản lý việc chuyển trạng thái của các yêu cầu.",
        icon: ArrowLeftRight,
        permission: "can_return_ticket",
      },
    ],
  },
  {
    label: "Danh sách phê duyệt",
    icon: ClipboardCheck,
    pages: [
      {
        path: APP_ROUTES.approvals.pending,
        legacyPaths: [APP_ROUTES.legacy.pendingApprovals],
        label: "Chờ phê duyệt",
        description: "Xem các yêu cầu đang chờ bạn phê duyệt.",
        icon: Clock3,
        permission: "can_accept",
      },
      {
        path: APP_ROUTES.approvals.approved,
        legacyPaths: [APP_ROUTES.legacy.approvedRequests],
        label: "Đã phê duyệt",
        description: "Theo dõi các yêu cầu đã được phê duyệt.",
        icon: CheckCheck,
        permission: "can_accept",
      },
    ],
  },
  {
    label: "Nhiệm vụ của tôi",
    icon: ListChecks,
    pages: [
      {
        path: APP_ROUTES.tasks.mine,
        legacyPaths: [APP_ROUTES.legacy.personalTasks],
        label: "Nhiệm vụ cá nhân",
        description: "Theo dõi các nhiệm vụ được giao cho bạn.",
        icon: UserRoundCheck,
        permission: "can_process",
      },
      {
        path: APP_ROUTES.tasks.all,
        legacyPaths: [APP_ROUTES.legacy.tasks],
        label: "Tất cả nhiệm vụ",
        description: "Theo dõi nhiệm vụ của bộ phận xử lý.",
        icon: FolderKanban,
        permission: "can_process",
      },
    ],
  },
  {
    label: "Báo cáo & dữ liệu",
    icon: BarChart3,
    pages: [
      {
        path: APP_ROUTES.reports.overview,
        label: "Báo cáo",
        description: "Tổng hợp tình hình tiếp nhận và xử lý yêu cầu.",
        icon: FileChartColumn,
        permission: "can_report",
      },
      {
        path: APP_ROUTES.reports.export,
        legacyPaths: [APP_ROUTES.legacy.exportData],
        label: "Truy xuất dữ liệu",
        description: "Tra cứu và xuất dữ liệu yêu cầu.",
        icon: Database,
        permission: "can_export",
      },
    ],
  },
  {
    label: "Tuyển dụng",
    icon: BriefcaseBusiness,
    pages: [
      {
        path: APP_ROUTES.recruitment.requests,
        legacyPaths: [APP_ROUTES.legacy.recruitmentRequests],
        label: "Yêu cầu tuyển dụng",
        description: "Quản lý nhu cầu và đề xuất tuyển dụng.",
        icon: ClipboardList,
        permission: "can_hr_rec",
      },
      {
        path: APP_ROUTES.recruitment.candidates,
        legacyPaths: [APP_ROUTES.legacy.candidates],
        label: "Quản lý ứng viên",
        description: "Quản lý thông tin và hồ sơ ứng viên.",
        icon: Users,
        permission: "can_hr_rec",
      },
      {
        path: APP_ROUTES.recruitment.interviews,
        legacyPaths: [APP_ROUTES.legacy.interviews],
        label: "Lịch phỏng vấn",
        description: "Theo dõi và sắp xếp lịch phỏng vấn.",
        icon: CalendarDays,
        permission: "can_hr_rec",
        activePaths: [APP_ROUTES.recruitment.interviewDetail],
      },
      {
        path: APP_ROUTES.recruitment.reports,
        legacyPaths: [APP_ROUTES.legacy.recruitmentReports],
        label: "Báo cáo tuyển dụng",
        description: "Tổng hợp tiến độ và kết quả tuyển dụng.",
        icon: BarChart3,
        permission: "can_hr_rec",
      },
    ],
  },
  {
    label: "Cấu hình hệ thống",
    icon: Settings,
    pages: [
      {
        path: APP_ROUTES.settings.users,
        label: "Người dùng",
        description: "Quản lý danh sách người dùng.",
        icon: Users,
        permission: "can_system",
        activePaths: [APP_ROUTES.settings.createUser],
      },
      {
        path: APP_ROUTES.settings["requesting-departments"],
        legacyPaths: [APP_ROUTES.legacy.requestingDepartments],
        label: "Bộ phận sử dụng",
        description: "Quản lý các bộ phận gửi yêu cầu.",
        icon: Building2,
        permission: "can_system",
      },
      {
        path: APP_ROUTES.settings["handling-departments"],
        legacyPaths: [APP_ROUTES.legacy.handlingDepartments],
        label: "Bộ phận xử lý",
        description: "Quản lý các bộ phận tiếp nhận và xử lý yêu cầu.",
        icon: FolderKanban,
        permission: "can_system",
      },
      {
        path: APP_ROUTES.settings["request-types"],
        legacyPaths: [APP_ROUTES.legacy.requestTypes],
        label: "Loại yêu cầu",
        description: "Quản lý danh mục loại yêu cầu.",
        icon: Tags,
        permission: "can_system",
      },
      {
        path: APP_ROUTES.settings.teams,
        legacyPaths: [APP_ROUTES.legacy.teams],
        label: "Team",
        description: "Quản lý danh sách nhóm làm việc.",
        icon: UsersRound,
        permission: "can_system",
      },
      {
        path: APP_ROUTES.settings.positions,
        legacyPaths: [APP_ROUTES.legacy.positions],
        label: "Chức vụ",
        description: "Quản lý danh mục chức vụ.",
        icon: BadgeCheck,
        permission: "can_system",
      },
      {
        path: APP_ROUTES.settings.offices,
        legacyPaths: [APP_ROUTES.legacy.offices],
        label: "Văn phòng",
        description: "Quản lý danh sách văn phòng.",
        icon: Building2,
        permission: "can_system",
      },
    ],
  },
];

// Pages available by URL but not listed in the sidebar.
const contextualPages: WorkspacePageDefinition[] = [
  {
    path: APP_ROUTES.settings.overview,
    label: "Tổng quan cấu hình",
    description: "Quản lý tài khoản và danh mục hệ thống.",
    icon: Settings,
    permission: "can_system",
  },
  {
    path: APP_ROUTES.requests.detail,
    legacyPaths: [APP_ROUTES.legacy.ticketDetail],
    label: "Chi tiết yêu cầu",
    description: "Xem nội dung và tiến độ xử lý yêu cầu.",
    icon: FileText,
    permission: "can_view",
  },
  {
    path: APP_ROUTES.requests.fromEmail,
    legacyPaths: [APP_ROUTES.legacy.ticketFromEmail],
    label: "Yêu cầu từ email",
    description: "Xem yêu cầu được tiếp nhận qua email.",
    icon: Inbox,
    permission: "can_view",
  },
  {
    path: APP_ROUTES.settings.createUser,
    legacyPaths: [APP_ROUTES.legacy.createUser],
    label: "Tạo người dùng",
    description: "Thêm tài khoản người dùng vào hệ thống.",
    icon: UserPlus,
    permission: "can_system",
  },
  {
    path: APP_ROUTES.recruitment.interviewDetail,
    legacyPaths: [APP_ROUTES.legacy.interviewDetail],
    label: "Chi tiết CV phỏng vấn",
    description: "Xem hồ sơ và thông tin phỏng vấn của ứng viên.",
    icon: FileText,
    permission: "can_cv_interview",
  },
];

export const workspacePages = [
  createTicketPage,
  ...navigationGroups.flatMap((group) => group.pages),
  ...contextualPages,
];

export function canAccessPage(
  page: WorkspacePageDefinition,
  permissions: UserPermissions | null,
): boolean {
  return permissions?.[page.permission] === true;
}

export function getDefaultWorkspacePath(
  permissions: UserPermissions | null,
): string {
  const firstPage = navigationGroups
    .flatMap((group) => group.pages)
    .find((page) => canAccessPage(page, permissions));
  if (firstPage) return firstPage.path;
  return canAccessPage(createTicketPage, permissions)
    ? createTicketPage.path
    : HOME_PATH;
}

export function isPageActive(
  page: WorkspacePageDefinition,
  pathname: string,
): boolean {
  return (
    pathname === page.path ||
    (page.activePaths ?? []).some((path) => {
      const match = matchPath(path, pathname);
      if (path === APP_ROUTES.requests.detail)
        return /^[1-9]\d*$/.test(match?.params.ticketID ?? "");
      return match !== null;
    })
  );
}
