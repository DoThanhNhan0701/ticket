import type { RecruitmentAction, RecruitmentField } from "../types";
const candidateFields: RecruitmentField[] = [
  { name: "first_name", label: "Họ và tên", required: true, min: 3, max: 150 },
  { name: "birthday", label: "Ngày sinh", type: "date" },
  {
    name: "gender",
    label: "Giới tính",
    type: "select",
    lookup: "genders",
    required: true,
  },
  { name: "numberphone", label: "Số điện thoại", required: true },
  {
    name: "city_code",
    label: "Tỉnh/Thành phố",
    type: "select",
    lookup: "cities",
    required: true,
  },
  {
    name: "district_code",
    label: "Quận/Huyện",
    type: "select",
    lookup: "districts",
  },
  { name: "address", label: "Địa chỉ" },
  { name: "email", label: "Email", type: "email" },
  {
    name: "education_level",
    label: "Trình độ học vấn",
    type: "select",
    lookup: "education",
  },
  { name: "education_major", label: "Chuyên ngành" },
  { name: "language_skill", label: "Trình độ ngoại ngữ" },
  { name: "application_date", label: "Ngày ứng tuyển", type: "date" },
  {
    name: "candidate_source",
    label: "Nguồn ứng viên",
    type: "select",
    lookup: "sources",
  },
];
export const actionLabels: Record<RecruitmentAction, string> = {
  request: "Chi tiết yêu cầu tuyển dụng",
  candidate: "Chi tiết ứng viên",
  "view-candidate": "Xem hồ sơ ứng viên",
  "create-candidate": "Thêm ứng viên",
  status: "Chuyển trạng thái CV",
  duplicate: "Kiểm tra hồ sơ trùng",
  "delete-candidate": "Xóa hồ sơ ứng viên",
  "delete-file": "Xóa tệp CV",
  attach: "Thêm ứng viên vào lịch phỏng vấn",
  interview: "Lịch phỏng vấn",
  "delete-interview": "Xóa lịch phỏng vấn",
  note: "Ghi chú phỏng vấn",
  "remove-interview-cv": "Bỏ ứng viên khỏi lịch phỏng vấn",
  "candidate-time": "Đặt giờ phỏng vấn ứng viên",
};
export function recruitmentFields(
  action: RecruitmentAction,
): RecruitmentField[] {
  switch (action) {
    case "request":
      return [
        { name: "ticket_code", label: "Mã yêu cầu", readonly: true },
        { name: "title", label: "Tiêu đề yêu cầu", readonly: true },
        { name: "quantity", label: "Số lượng", type: "number", required: true },
        {
          name: "department_recruited_name",
          label: "Bộ phận tuyển dụng",
          readonly: true,
        },
        { name: "rec_position", label: "Vị trí tuyển dụng", readonly: true },
        { name: "duedate", label: "Ngày hết hạn", readonly: true },
        { name: "work_location", label: "Địa điểm làm việc", readonly: true },
        {
          name: "reason_recr_id",
          label: "Lý do tuyển",
          type: "select",
          lookup: "reasons",
        },
        { name: "user_new_quits", label: "Tuyển thay thế nhân viên" },
        { name: "language_skill", label: "Trình độ ngoại ngữ" },
        { name: "computer_skill", label: "Trình độ tin học" },
        {
          name: "job_description",
          label: "Mô tả công việc",
          type: "textarea",
          readonly: true,
        },
        {
          name: "experience",
          label: "Yêu cầu chuyên môn",
          type: "textarea",
          readonly: true,
        },
        { name: "note", label: "Ghi chú", type: "textarea" },
      ];
    case "create-candidate":
      return [
        ...candidateFields.map((field) =>
          ["district_code", "address"].includes(field.name)
            ? { ...field, required: true }
            : field,
        ),
        { name: "note", label: "Ghi chú", type: "textarea" },
      ];
    case "view-candidate":
    case "candidate":
      return (
        [
          ...candidateFields,
          {
            name: "ls_user_received",
            label: "Người phụ trách",
            type: "multi",
            lookup: "users",
          },
          {
            name: "cv_status",
            label: "Trạng thái CV",
            type: "select",
            lookup: "statuses",
            required: true,
          },
          {
            name: "why_change",
            label: "Lý do chuyển trạng thái",
            type: "textarea",
          },
          { name: "note", label: "Ghi chú / File phỏng vấn", type: "textarea" },
        ] satisfies RecruitmentField[]
      ).map((field) =>
        action === "view-candidate" ? { ...field, readonly: true } : field,
      );
    case "status":
      return [
        {
          name: "cv_status",
          label: "Trạng thái",
          type: "select",
          lookup: "statuses",
          required: true,
        },
        {
          name: "why_change",
          label: "Lý do chuyển trạng thái",
          type: "textarea",
        },
      ];
    case "interview":
      return [
        { name: "title", label: "Tiêu đề", required: true, min: 5, max: 50 },
        {
          name: "start_date",
          label: "Ngày phỏng vấn",
          type: "date",
          required: true,
        },
        {
          name: "time_start",
          label: "Giờ bắt đầu",
          type: "time",
          required: true,
        },
        {
          name: "time_end",
          label: "Giờ kết thúc",
          type: "time",
          required: true,
        },
        {
          name: "user_interview",
          label: "Người phỏng vấn",
          type: "multi",
          lookup: "users",
        },
        { name: "note", label: "Ghi chú", type: "textarea", max: 255 },
      ];
    case "attach":
      return [
        {
          name: "start_date",
          label: "Ngày phỏng vấn",
          type: "date",
          required: true,
        },
        {
          name: "id_interview",
          label: "Lịch phỏng vấn",
          type: "select",
          lookup: "interviews",
          required: true,
        },
      ];
    case "note":
      return [{ name: "note", label: "Ghi chú phỏng vấn", type: "textarea" }];
    case "candidate-time":
      return [{ name: "time_start", label: "Giờ phỏng vấn", type: "time" }];
    default:
      return [];
  }
}
