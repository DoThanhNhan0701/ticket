import type { TemplateGroup } from "@/features/settings/schemas/template-schema";
export const createTemplate: TemplateGroup[] = [
  {
    title: "Nội dung chi tiết",
    editable: true,
    colortitle: "#6468af",
    children: [
      { key: 1, title: "Ghi chú chi tiết", type: "text", required: true },
      { key: 2, title: "Số lượng", type: "number", required: true },
      { key: 3, title: "Từ ngày", type: "date-text", required: true },
      {
        key: 4,
        title: "Đến ngày",
        type: "date-text",
        required: true,
        validate: { operator: ">=", target: "Từ ngày" },
      },
      {
        key: 5,
        title: "Khoảng ngày",
        type: "range-date-text",
        required: false,
      },
      { key: 6, title: "Phương án", type: "text", option: ["A", "B"] },
    ],
  },
];
export const filledDetail = {
  values: {
    f0: "Nội dung mẫu",
    f1: "2",
    f2: "20/10/2026",
    f3: "21/10/2026",
    f4_start: "20/10/2026",
    f4_end: "22/10/2026",
    f5: "A",
  },
};

export const createMultiSectionTemplate: TemplateGroup[] = [
  ...structuredClone(createTemplate),
  {
    title: "Phần bộ phận xử lý",
    editable: false,
    children: [
      { title: "Kết quả xử lý", type: "text", required: true },
      {
        title: "Ngày xử lý",
        type: "date-text",
        required: true,
        validate: { operator: ">=", target: "Từ ngày" },
      },
    ],
  },
  {
    title: "Phần nghiệm thu",
    editable: false,
    children: [{ title: "Kết quả nghiệm thu", type: "text", required: true }],
  },
];
