import type {
  ReportGroup,
  ReportResponse,
} from "@/features/reports/schemas/reports-schema";
import { requestTypeFixtures } from "./requests";

export const reportGroupFixtures: ReportGroup[] = [
  {
    id: 3,
    name: "IT",
    is_active: true,
    is_manager: 42,
    username_manager: "Manager",
    group_email: "it@example.test",
    description: null,
    ls_member: [42],
    created: "2026-10-19T10:00:00+07:00",
    updated: "2026-10-19T10:00:00+07:00",
  },
  {
    id: 4,
    name: "HR",
    is_active: true,
    is_manager: 84,
    username_manager: "Other Manager",
    group_email: "hr@example.test",
    description: null,
    ls_member: [84],
    created: "2026-10-19T10:00:00+07:00",
    updated: "2026-10-19T10:00:00+07:00",
  },
  {
    id: 5,
    name: "Inactive",
    is_active: false,
    is_manager: 42,
    username_manager: "Manager",
    group_email: null,
    description: null,
    ls_member: [],
    created: "2026-10-19T10:00:00+07:00",
    updated: "2026-10-19T10:00:00+07:00",
  },
];

export const reportTypeFixtures = [
  ...requestTypeFixtures,
  {
    ...requestTypeFixtures[0],
    id: 23,
    name: "Nhân sự",
    handling_group: 4,
    handling_group_name: "HR",
  },
];

export const reportFixture: ReportResponse = {
  dict_bieudo_01: {
    "Tổng yêu cầu": {
      count: 3,
      list_code: [
        ["RS-0042", 42],
        ["RS-0084", 84],
        ["RS-0126", 126],
      ],
    },
    "Đã hoàn thành": {
      count: 2,
      list_code: [
        ["RS-0042", 42],
        ["RS-0084", 84],
      ],
    },
    "Chờ xử lý": { count: 0, list_code: [] },
  },
  dict_bieudo_02: { Operator: 2, Support: 1 },
  dict_bieudo_03: { Operator: [100, 2, 2], Support: [0, 0, 1] },
  dict_bieudo_04: { "Thiết bị": [66.7, 2, 3], "Phần mềm": [33.3, 1, 3] },
};

export const emptyReportFixture: ReportResponse = {
  dict_bieudo_01: { "Tổng yêu cầu": { count: 0, list_code: [] } },
  dict_bieudo_02: {},
  dict_bieudo_03: {},
  dict_bieudo_04: {},
};

export const largeReportFixture: ReportResponse = {
  ...reportFixture,
  dict_bieudo_02: Object.fromEntries(
    Array.from({ length: 13 }, (_, index) => [
      `Handler${String(index + 1).padStart(2, "0")}`,
      index + 1,
    ]),
  ),
  dict_bieudo_03: Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [
      `Handler${String(index + 1).padStart(2, "0")}`,
      [(index * 100) / 11, index, 11],
    ]),
  ),
  dict_bieudo_04: {
    "Đăng ký làm việc từ xa": [41.2, 148, 359],
    "Cấp mới hoặc thu hồi quyền sử dụng tài sản cá nhân": [35.1, 126, 359],
    "Thu hồi đăng ký làm việc từ xa": [12.3, 44, 359],
    "Đăng ký mở hoặc khóa cổng USB": [4.5, 16, 359],
    "Cấp hoặc thu hồi quyền truy cập phần mềm ngoại lệ": [3.9, 14, 359],
    "Đánh giá thay đổi quan trọng": [3.1, 11, 359],
  },
};
