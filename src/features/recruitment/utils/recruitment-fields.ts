import { t } from "@/i18n";
import type { RecruitmentAction, RecruitmentField } from "../types";
const candidateFields: RecruitmentField[] = [
  {
    name: "first_name",
    get label() {
      return t("recruitment", "Họ và tên");
    },
    get placeholder() {
      return t("recruitment", "Nhập họ và tên ứng viên...");
    },
    required: true,
    min: 3,
    max: 150,
  },
  {
    name: "birthday",
    get label() {
      return t("recruitment", "Ngày sinh");
    },
    type: "date",
  },
  {
    name: "gender",
    get label() {
      return t("recruitment", "Giới tính");
    },
    type: "select",
    lookup: "genders",
    required: true,
  },
  {
    name: "numberphone",
    get label() {
      return t("recruitment", "Số điện thoại");
    },
    get placeholder() {
      return t("recruitment", "VD: 0912345678");
    },
    required: true,
  },
  {
    name: "city_code",
    get label() {
      return t("recruitment", "Tỉnh/Thành phố");
    },
    type: "select",
    lookup: "cities",
    required: true,
  },
  {
    name: "district_code",
    get label() {
      return t("recruitment", "Xã/Phường/Đặc khu");
    },
    type: "select",
    lookup: "districts",
  },
  {
    name: "address",
    get label() {
      return t("recruitment", "Địa chỉ");
    },
    get placeholder() {
      return t("recruitment", "Nhập số nhà, đường, phường/xã...");
    },
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    placeholder: "VD: ungvien@example.com",
  },
  {
    name: "education_level",
    get label() {
      return t("recruitment", "Trình độ học vấn");
    },
    type: "select",
    lookup: "education",
  },
  {
    name: "education_major",
    get label() {
      return t("recruitment", "Chuyên ngành");
    },
    get placeholder() {
      return t("recruitment", "VD: Công nghệ thông tin");
    },
  },
  {
    name: "language_skill",
    get label() {
      return t("recruitment", "Trình độ ngoại ngữ");
    },
    get placeholder() {
      return t("recruitment", "VD: Tiếng Anh giao tiếp, TOEIC 700");
    },
  },
  {
    name: "application_date",
    get label() {
      return t("recruitment", "Ngày ứng tuyển");
    },
    type: "date",
  },
  {
    name: "candidate_source",
    get label() {
      return t("recruitment", "Nguồn ứng viên");
    },
    type: "select",
    lookup: "sources",
  },
];
export const actionLabels: Record<RecruitmentAction, string> = {
  get request() {
    return t("recruitment", "Chi tiết yêu cầu tuyển dụng");
  },
  get candidate() {
    return t("recruitment", "Chi tiết ứng viên");
  },
  get "view-candidate"() {
    return t("recruitment", "Xem hồ sơ ứng viên");
  },
  get "create-candidate"() {
    return t("recruitment", "Thêm ứng viên");
  },
  get status() {
    return t("recruitment", "Chuyển trạng thái CV");
  },
  get duplicate() {
    return t("recruitment", "Kiểm tra hồ sơ trùng");
  },
  get "delete-candidate"() {
    return t("recruitment", "Xóa hồ sơ ứng viên");
  },
  get "delete-file"() {
    return t("recruitment", "Xóa tệp CV");
  },
  get attach() {
    return t("recruitment", "Thêm ứng viên vào lịch phỏng vấn");
  },
  get interview() {
    return t("recruitment", "Lịch phỏng vấn");
  },
  get "delete-interview"() {
    return t("recruitment", "Xóa lịch phỏng vấn");
  },
  get note() {
    return t("recruitment", "Ghi chú phỏng vấn");
  },
  get "remove-interview-cv"() {
    return t("recruitment", "Bỏ ứng viên khỏi lịch phỏng vấn");
  },
  get "candidate-time"() {
    return t("recruitment", "Đặt giờ phỏng vấn ứng viên");
  },
};
export function recruitmentFields(
  action: RecruitmentAction,
  timeRange?: { start: string; end: string },
): RecruitmentField[] {
  switch (action) {
    case "request":
      return [
        {
          name: "ticket_code",
          label: t("recruitment", "Mã yêu cầu"),
          readonly: true,
        },
        {
          name: "title",
          label: t("recruitment", "Tiêu đề yêu cầu"),
          readonly: true,
        },
        {
          name: "quantity",
          label: t("recruitment", "Số lượng"),
          type: "number",
          placeholder: t("recruitment", "Nhập số lượng cần tuyển..."),
          required: true,
        },
        {
          name: "department_recruited_name",
          label: t("recruitment", "Bộ phận tuyển dụng"),
          readonly: true,
        },
        {
          name: "rec_position",
          label: t("recruitment", "Vị trí tuyển dụng"),
          readonly: true,
        },
        {
          name: "duedate",
          label: t("recruitment", "Ngày hết hạn"),
          type: "date",
          readonly: true,
        },
        {
          name: "work_location",
          label: t("recruitment", "Địa điểm làm việc"),
          readonly: true,
        },
        {
          name: "reason_recr_id",
          label: t("recruitment", "Lý do tuyển"),
          type: "select",
          lookup: "reasons",
        },
        {
          name: "user_new_quits",
          label: t("recruitment", "Tuyển thay thế nhân viên"),
          placeholder: t("recruitment", "Nhập tên nhân viên cần thay thế..."),
        },
        {
          name: "language_skill",
          label: t("recruitment", "Trình độ ngoại ngữ"),
          placeholder: t("recruitment", "VD: Tiếng Anh giao tiếp, TOEIC 700"),
        },
        {
          name: "computer_skill",
          label: t("recruitment", "Trình độ tin học"),
          placeholder: t("recruitment", "VD: Word, Excel, PowerPoint"),
        },
        {
          name: "other_skill",
          label: t("recruitment", "Kỹ năng khác"),
          readonly: true,
        },
        {
          name: "user_update_name",
          label: t("recruitment", "Người cập nhật"),
          readonly: true,
        },
        {
          name: "job_description",
          label: t("recruitment", "Mô tả công việc"),
          type: "textarea",
          readonly: true,
        },
        {
          name: "experience",
          label: t("recruitment", "Yêu cầu chuyên môn"),
          type: "textarea",
          readonly: true,
        },
        { name: "note", label: t("recruitment", "Ghi chú"), type: "textarea" },
      ];
    case "create-candidate":
      return [
        ...candidateFields.map((field) =>
          ["district_code", "address"].includes(field.name)
            ? { ...field, required: true }
            : field,
        ),
        { name: "note", label: t("recruitment", "Ghi chú"), type: "textarea" },
      ];
    case "view-candidate":
    case "candidate":
      return (
        [
          ...candidateFields,
          {
            name: "ls_user_received",
            label: t("recruitment", "Người phụ trách"),
            type: "multi",
            lookup: "users",
          },
          {
            name: "cv_status",
            label: t("recruitment", "Trạng thái CV"),
            type: "select",
            lookup: "statuses",
            readonly: true,
          },
          ...(action === "view-candidate"
            ? [
                {
                  name: "why_change",
                  label: t("recruitment", "Lý do chuyển trạng thái"),
                  type: "textarea" as const,
                  readonly: true,
                },
              ]
            : []),
          ...(action === "view-candidate"
            ? [
                {
                  name: "note",
                  label: t("recruitment", "Ghi chú / File phỏng vấn"),
                  type: "textarea" as const,
                  readonly: true,
                },
              ]
            : []),
        ] satisfies RecruitmentField[]
      ).map((field) =>
        action === "view-candidate" ? { ...field, readonly: true } : field,
      );
    case "status":
      return [
        {
          name: "cv_status",
          label: t("recruitment", "Trạng thái"),
          type: "select",
          lookup: "statuses",
          required: true,
        },
        {
          name: "why_change",
          label: t("recruitment", "Lý do chuyển trạng thái"),
          placeholder: t(
            "recruitment",
            "Nhập lý do chuyển trạng thái ứng viên...",
          ),
          type: "textarea",
        },
      ];
    case "interview":
      return [
        {
          name: "title",
          label: t("recruitment", "Tiêu đề"),
          placeholder: t(
            "recruitment",
            "VD: Phỏng vấn vị trí Frontend Developer",
          ),
          required: true,
          min: 5,
          max: 50,
        },
        {
          name: "start_date",
          label: t("recruitment", "Ngày phỏng vấn"),
          type: "date",
          required: true,
        },
        {
          name: "time_start",
          label: t("recruitment", "Giờ bắt đầu"),
          type: "time",
          required: true,
        },
        {
          name: "time_end",
          label: t("recruitment", "Giờ kết thúc"),
          type: "time",
          required: true,
        },
        {
          name: "user_interview",
          label: t("recruitment", "Người phỏng vấn"),
          type: "multi",
          lookup: "users",
        },
        {
          name: "note",
          label: t("recruitment", "Ghi chú"),
          type: "textarea",
          max: 255,
        },
      ];
    case "attach":
      return [
        {
          name: "start_date",
          label: t("recruitment", "Ngày phỏng vấn"),
          type: "date",
          required: true,
        },
        {
          name: "id_interview",
          label: t("recruitment", "Lịch phỏng vấn"),
          type: "select",
          lookup: "interviews",
          required: true,
        },
      ];
    case "note":
      return [
        {
          name: "note",
          label: t("recruitment", "Ghi chú phỏng vấn"),
          placeholder: t(
            "recruitment",
            "Nhập nhận xét, kết quả hoặc lưu ý sau phỏng vấn...",
          ),
          type: "textarea",
        },
      ];
    case "candidate-time":
      return [
        {
          name: "time_start",
          label: t("recruitment", "Giờ phỏng vấn"),
          type: "time",
          minTime: timeRange?.start,
          maxTime: timeRange?.end,
        },
      ];
    default:
      return [];
  }
}

export function recruitmentUploadNames(action: RecruitmentAction): string[] {
  if (
    action === "request" ||
    action === "candidate" ||
    action === "create-candidate"
  )
    return ["file_upload"];
  if (action === "note") return ["file_note"];
  return [];
}
