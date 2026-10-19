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

export interface WorkspacePageDefinition {
  path: string;
  legacyPaths?: readonly string[];
  label: string;
  description: string;
  icon: LucideIcon;
  permissions?: readonly string[];
  activePaths?: readonly string[];
}

export interface NavigationGroup {
  label: string;
  icon: LucideIcon;
  pages: WorkspacePageDefinition[];
}

export const createTicketPage: WorkspacePageDefinition = {
  path: "/requests/new",
  legacyPaths: ["/create_ticket"],
  label: "Tạo yêu cầu",
  description: "Tạo yêu cầu hỗ trợ và gửi đến bộ phận phụ trách.",
  icon: Plus,
  permissions: ["can_create"],
};

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Yêu cầu",
    icon: Ticket,
    pages: [
      {
        path: HOME_PATH,
        legacyPaths: ["/danhsachyeucau"],
        label: "Danh sách yêu cầu",
        description: "Theo dõi các yêu cầu bạn đã gửi.",
        icon: Inbox,
        permissions: ["can_create"],
        activePaths: ["/tickets/:ticketID", "/tickets/from-email/:ticketID"],
      },
      {
        path: "/requests/all",
        legacyPaths: ["/tatcayeucau"],
        label: "Tất cả yêu cầu",
        description: "Tra cứu yêu cầu trên toàn hệ thống.",
        icon: ListFilter,
        permissions: ["can_allticket"],
      },
      {
        path: "/requests/change-status",
        legacyPaths: ["/change_status"],
        label: "Chuyển trạng thái ticket",
        description: "Quản lý việc chuyển trạng thái của các yêu cầu.",
        icon: ArrowLeftRight,
        permissions: ["can_return_ticket"],
      },
    ],
  },
  {
    label: "Danh sách phê duyệt",
    icon: ClipboardCheck,
    pages: [
      {
        path: "/approvals/pending",
        legacyPaths: ["/chopheduyet"],
        label: "Chờ phê duyệt",
        description: "Xem các yêu cầu đang chờ bạn phê duyệt.",
        icon: Clock3,
        permissions: ["can_accept"],
      },
      {
        path: "/approvals/approved",
        legacyPaths: ["/dapheduyet"],
        label: "Đã phê duyệt",
        description: "Theo dõi các yêu cầu đã được phê duyệt.",
        icon: CheckCheck,
        permissions: ["can_accept"],
      },
    ],
  },
  {
    label: "Nhiệm vụ của tôi",
    icon: ListChecks,
    pages: [
      {
        path: "/tasks/mine",
        legacyPaths: ["/danhsachxulycanhan"],
        label: "Nhiệm vụ cá nhân",
        description: "Theo dõi các nhiệm vụ được giao cho bạn.",
        icon: UserRoundCheck,
        permissions: ["can_process"],
      },
      {
        path: "/tasks",
        legacyPaths: ["/danhsachxuly"],
        label: "Tất cả nhiệm vụ",
        description: "Theo dõi nhiệm vụ của bộ phận xử lý.",
        icon: FolderKanban,
        permissions: ["can_process"],
      },
    ],
  },
  {
    label: "Báo cáo & dữ liệu",
    icon: BarChart3,
    pages: [
      {
        path: "/reports",
        label: "Báo cáo",
        description: "Tổng hợp tình hình tiếp nhận và xử lý yêu cầu.",
        icon: FileChartColumn,
        permissions: ["can_report"],
      },
      {
        path: "/reports/export",
        legacyPaths: ["/export_data"],
        label: "Truy xuất dữ liệu",
        description: "Tra cứu và xuất dữ liệu yêu cầu.",
        icon: Database,
        permissions: ["can_report"],
      },
    ],
  },
  {
    label: "Tuyển dụng",
    icon: BriefcaseBusiness,
    pages: [
      {
        path: "/recruitment/requests",
        legacyPaths: ["/recruitment_system"],
        label: "Yêu cầu tuyển dụng",
        description: "Quản lý nhu cầu và đề xuất tuyển dụng.",
        icon: ClipboardList,
        permissions: ["can_hr_rec"],
      },
      {
        path: "/recruitment/candidates",
        legacyPaths: ["/candidate_management"],
        label: "Quản lý ứng viên",
        description: "Quản lý thông tin và hồ sơ ứng viên.",
        icon: Users,
        permissions: ["can_hr_rec"],
      },
      {
        path: "/recruitment/interviews",
        legacyPaths: ["/interview-schedule-table"],
        label: "Lịch phỏng vấn",
        description: "Theo dõi và sắp xếp lịch phỏng vấn.",
        icon: CalendarDays,
        permissions: ["can_hr_rec"],
        activePaths: ["/recruitment/interviews/:codeInterview"],
      },
      {
        path: "/recruitment/reports",
        legacyPaths: ["/report_recruitment"],
        label: "Báo cáo tuyển dụng",
        description: "Tổng hợp tiến độ và kết quả tuyển dụng.",
        icon: BarChart3,
        permissions: ["can_hr_rec"],
      },
    ],
  },
  {
    label: "Cấu hình hệ thống",
    icon: Settings,
    pages: [
      {
        path: "/settings/users",
        label: "Người dùng",
        description: "Quản lý danh sách người dùng.",
        icon: Users,
        permissions: ["can_system", "is_system_manage"],
        activePaths: ["/settings/users/new"],
      },
      {
        path: "/settings/requesting-departments",
        legacyPaths: ["/settings/bophansudung"],
        label: "Bộ phận sử dụng",
        description: "Quản lý các bộ phận gửi yêu cầu.",
        icon: Building2,
        permissions: ["can_system", "is_system_manage"],
      },
      {
        path: "/settings/handling-departments",
        legacyPaths: ["/settings/bophanxuly"],
        label: "Bộ phận xử lý",
        description: "Quản lý các bộ phận tiếp nhận và xử lý yêu cầu.",
        icon: FolderKanban,
        permissions: ["can_system", "is_system_manage"],
      },
      {
        path: "/settings/request-types",
        legacyPaths: ["/settings/loaiyeucau"],
        label: "Loại yêu cầu",
        description: "Quản lý danh mục loại yêu cầu.",
        icon: Tags,
        permissions: ["can_system", "is_system_manage"],
      },
      {
        path: "/settings/teams",
        legacyPaths: ["/settings/team"],
        label: "Team",
        description: "Quản lý danh sách nhóm làm việc.",
        icon: UsersRound,
        permissions: ["can_system", "is_system_manage"],
      },
      {
        path: "/settings/positions",
        legacyPaths: ["/settings/chucvu"],
        label: "Chức vụ",
        description: "Quản lý danh mục chức vụ.",
        icon: BadgeCheck,
        permissions: ["can_system", "is_system_manage"],
      },
      {
        path: "/settings/offices",
        legacyPaths: ["/settings/vanphong"],
        label: "Văn phòng",
        description: "Quản lý danh sách văn phòng.",
        icon: Building2,
        permissions: ["can_system", "is_system_manage"],
      },
    ],
  },
];

// Pages available by URL but not listed in the sidebar.
const contextualPages: WorkspacePageDefinition[] = [
  {
    path: "/settings",
    label: "Tổng quan cấu hình",
    description: "Quản lý tài khoản và danh mục hệ thống.",
    icon: Settings,
    permissions: ["can_system", "is_system_manage"],
  },
  {
    path: "/tickets/:ticketID",
    label: "Chi tiết yêu cầu",
    description: "Xem nội dung và tiến độ xử lý yêu cầu.",
    icon: FileText,
    permissions: ["can_create"],
  },
  {
    path: "/tickets/from-email/:ticketID",
    legacyPaths: ["/tickets-from-mail/view/:ticketID"],
    label: "Yêu cầu từ email",
    description: "Xem yêu cầu được tiếp nhận qua email.",
    icon: Inbox,
    permissions: ["can_create"],
  },
  {
    path: "/settings/users/new",
    legacyPaths: ["/settings/create_user"],
    label: "Tạo người dùng",
    description: "Thêm tài khoản người dùng vào hệ thống.",
    icon: UserPlus,
    permissions: ["can_system", "is_system_manage"],
  },
  {
    path: "/recruitment/interviews/:codeInterview",
    legacyPaths: ["/detail-interview/:codeInterview"],
    label: "Chi tiết CV phỏng vấn",
    description: "Xem hồ sơ và thông tin phỏng vấn của ứng viên.",
    icon: FileText,
    permissions: ["can_cv_interview"],
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
  return (
    !page.permissions ||
    permissions?.is_superuser === true ||
    page.permissions.some((permission) => permissions?.[permission] === true)
  );
}

export function isPageActive(
  page: WorkspacePageDefinition,
  pathname: string,
): boolean {
  return (
    pathname === page.path ||
    (page.activePaths ?? []).some((path) => matchPath(path, pathname) !== null)
  );
}
