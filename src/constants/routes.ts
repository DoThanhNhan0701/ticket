export const APP_ROUTES = {
  root: "/",
  login: "/login",
  forbidden: "/forbidden",
  help: "/help",
  notFound: "*",
  requests: {
    list: "/requests",
    create: "/requests/new",
    all: "/requests/all",
    changeStatus: "/requests/change-status",
    detail: "/requests/:ticketID",
    fromEmail: "/tickets/from-email/:ticketID",
  },
  approvals: {
    pending: "/approvals/pending",
    approved: "/approvals/approved",
  },
  tasks: {
    all: "/tasks",
    mine: "/tasks/mine",
  },
  reports: {
    overview: "/reports",
    export: "/reports/export",
  },
  recruitment: {
    requests: "/recruitment/requests",
    candidates: "/recruitment/candidates",
    interviews: "/recruitment/interviews",
    reports: "/recruitment/reports",
    interviewDetail: "/recruitment/interviews/:codeInterview",
  },
  settings: {
    overview: "/settings",
    users: "/settings/users",
    createUser: "/settings/users/new",
    "requesting-departments": "/settings/requesting-departments",
    "handling-departments": "/settings/handling-departments",
    "request-types": "/settings/request-types",
    teams: "/settings/teams",
    positions: "/settings/positions",
    offices: "/settings/offices",
  },
  legacy: {
    createRequest: "/create_ticket",
    requests: "/danhsachyeucau",
    allRequests: "/tatcayeucau",
    changeStatus: "/change_status",
    pendingApprovals: "/chopheduyet",
    approvedRequests: "/dapheduyet",
    personalTasks: "/danhsachxulycanhan",
    tasks: "/danhsachxuly",
    exportData: "/export_data",
    recruitmentRequests: "/recruitment_system",
    candidates: "/candidate_management",
    interviews: "/interview-schedule-table",
    recruitmentReports: "/report_recruitment",
    requestingDepartments: "/settings/bophansudung",
    handlingDepartments: "/settings/bophanxuly",
    requestTypes: "/settings/loaiyeucau",
    teams: "/settings/team",
    positions: "/settings/chucvu",
    offices: "/settings/vanphong",
    ticketDetail: "/tickets/:ticketID",
    ticketFromEmail: "/tickets-from-mail/view/:ticketID",
    createUser: "/settings/create_user",
    interviewDetail: "/detail-interview/:codeInterview",
  },
} as const;

export const PAGE_LINKS = {
  requestDetail: (id: string | number) =>
    APP_ROUTES.requests.detail.replace(
      ":ticketID",
      encodeURIComponent(String(id)),
    ),
  cloneRequest: (id: string | number) =>
    `${APP_ROUTES.requests.create}?clone=${encodeURIComponent(String(id))}`,
  interviewDetail: (code: string) =>
    APP_ROUTES.recruitment.interviewDetail.replace(
      ":codeInterview",
      encodeURIComponent(code),
    ),
} as const;
