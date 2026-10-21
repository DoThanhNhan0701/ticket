import { expect, it } from "vitest";
import { addBusinessDays, format } from "date-fns";
import {
  getCreateRequestSchema,
  type CreateRequestValues,
} from "@/features/requests/schemas/create-request-schema";
import {
  importedDetailRows,
  getCreateRequestGroups,
  detailFields,
  isDetailDateDisabled,
  parseRequestDate,
  serializeRequestDetails,
  serializeCreateRequestDetails,
  validateDetailRows,
} from "@/features/requests/utils/request-detail-data";
import {
  createTemplate,
  createMultiSectionTemplate,
  filledDetail,
} from "./fixtures/create-request";

const values = (): CreateRequestValues => ({
  handling_group: "5",
  ticket_type: "186",
  approve_user: "42",
  fore_cus: "2",
  bophansudung: "20",
  other1: [],
  vanphong: "3",
  title: "Request",
  description: "",
  duedate: format(addBusinessDays(new Date(), 5), "dd/MM/yyyy"),
  rows: [structuredClone(filledDetail)],
});
it.each([
  ["title", " ", false],
  ["title", "x".repeat(300), true],
  ["title", "x".repeat(301), false],
  ["description", "x".repeat(1000), true],
  ["description", "x".repeat(1001), false],
] as const)("enforces the %s boundary for %s", (name, value, valid) => {
  const data = values();
  data[name] = value;
  expect(getCreateRequestSchema(createTemplate).safeParse(data).success).toBe(
    valid,
  );
});
it.each([
  "handling_group",
  "ticket_type",
  "approve_user",
  "fore_cus",
  "bophansudung",
  "vanphong",
  "other1",
] as const)(
  "rejects %s selections outside the current active catalog",
  (name) => {
    const data = values();
    if (name === "other1") data.other1 = ["999"];
    const schema = getCreateRequestSchema(createTemplate, [], {
      [name]: [{ id: 12345 }],
    });
    const invalid = schema.safeParse(data);
    expect(invalid.success).toBe(false);
    if (!invalid.success)
      expect(invalid.error.issues.some((issue) => issue.path[0] === name)).toBe(
        true,
      );
    const selected = name === "other1" ? data.other1[0] : data[name];
    expect(
      getCreateRequestSchema(createTemplate, [], {
        [name]: [{ id: Number(selected) }],
      }).safeParse(data).success,
    ).toBe(true);
  },
);
it.each(["31/02/2026", "29/02/2025", "2026-02-30", "not a date"])(
  "rejects invalid date %s",
  (value) => expect(parseRequestDate(value)).toBeUndefined(),
);
it("validates the complete detail matrix, including zero quantities and an optional blank range", () => {
  const data = values();
  data.rows[0].values.f1 = "0";
  data.rows[0].values.f4_start = "";
  data.rows[0].values.f4_end = "";
  expect(getCreateRequestSchema(createTemplate).safeParse(data).success).toBe(
    true,
  );
});
it.each([
  ["", "", ["f0_start", "f0_end"]],
  ["20/10/2026", "", ["f0_end"]],
  ["", "21/10/2026", ["f0_start"]],
  ["20/10/2026", "19/10/2026", ["f0_end"]],
  ["20/10/2026", "31/02/2026", ["f0_end"]],
  ["20/10/2026", "20/10/2026", []],
  ["20/10/2026", "21/10/2026", []],
])(
  "attributes required training range errors to their endpoints (%s, %s)",
  (start, end, keys) => {
    const groups = [
      {
        title: "Phần dành cho Bộ phận yêu cầu",
        children: [
          {
            title: "Thời gian đào tạo (*)",
            type: "range-date-text",
            required: true,
          },
        ],
      },
    ];
    expect(
      validateDetailRows(groups, [
        { values: { f0_start: start, f0_end: end } },
      ]).map((issue) => issue.path[issue.path.length - 1]),
    ).toEqual(keys);
  },
);
it.each([
  ["f0", "", "Vui lòng nhập Ghi chú chi tiết."],
  ["f1", "infinity", "Vui lòng nhập số hợp lệ."],
  ["f2", "31/02/2026", "Ngày không hợp lệ"],
  ["f3", "19/10/2026", "Ngày phải >= Từ ngày."],
  ["f4_end", "19/10/2026", "khoảng ngày hợp lệ"],
  ["f5", "forged option", "Vui lòng chọn giá trị"],
])("blocks bad detail value %s=%s before submitting", (key, value, message) => {
  const row = structuredClone(filledDetail);
  row.values[key as keyof typeof row.values] = value;
  expect(
    validateDetailRows(createTemplate, [row]).some((issue) =>
      issue.message.includes(message),
    ),
  ).toBe(true);
});
it("enforces all date comparison operators on each row", () => {
  for (const [operator, date, valid] of [
    [">", "21/10/2026", true],
    [">", "20/10/2026", false],
    [">=", "20/10/2026", true],
    ["<", "19/10/2026", true],
    ["<=", "20/10/2026", true],
    ["<=", "21/10/2026", false],
  ] as const) {
    const groups = structuredClone(createTemplate);
    groups[0].children[3].validate = { operator, target: "Từ ngày" };
    const row = structuredClone(filledDetail);
    row.values.f3 = date;
    expect(validateDetailRows(groups, [row]).length === 0).toBe(valid);
  }
});
it.each([
  [">", [true, true, false]],
  [">=", [true, false, false]],
  ["<", [false, false, false]],
  ["<=", [false, false, false]],
] as const)(
  "applies only implied lower bounds to the end of a range with %s",
  (operator, expected) => {
    const groups = structuredClone(createTemplate);
    groups[0].children[4].validate = { operator, target: "Từ ngày" };
    const fields = detailFields(groups);
    const row = structuredClone(filledDetail);
    row.values.f4_start = "";
    expect(
      [19, 20, 21].map((day) =>
        isDetailDateDisabled(
          new Date(2026, 9, day, 12),
          fields[4],
          row,
          fields,
          "end",
        ),
      ),
    ).toEqual(expected);
  },
);
it("matches date rules across sections and normalizes required markers in their titles", () => {
  const groups = structuredClone(createTemplate);
  const rest = groups[0].children.splice(3);
  groups.push({ title: "Phần ngày kết thúc", children: rest });
  groups[0].children[2].title = "Từ ngày (*)";
  groups[1].children[0].validate = { operator: ">=", target: "Từ ngày (*)" };
  const fields = detailFields(groups);
  expect(
    isDetailDateDisabled(
      new Date(2026, 9, 19),
      fields[3],
      filledDetail,
      fields,
    ),
  ).toBe(true);
  expect(
    isDetailDateDisabled(
      new Date(2026, 9, 20),
      fields[3],
      filledDetail,
      fields,
    ),
  ).toBe(false);
});
it("serializes the legacy grouped headers and keeps rows keyed without mutating the template", () => {
  const data = serializeRequestDetails(createTemplate, [
    filledDetail,
    filledDetail,
  ]);
  expect(data.dataform?.data).toHaveLength(2);
  expect(data.dataform?.data[0]).toMatchObject({
    key: 1,
    "Số lượng": "2",
    "Khoảng ngày": "20/10/2026 - 22/10/2026",
  });
  expect(data.dataform?.header[0].children[0]).toMatchObject({
    title: "Ghi chú chi tiết",
    dataIndex: "Ghi chú chi tiết",
    width: 200,
  });
  expect(data.dataform?.header).toEqual(data.dataform?.original_header);
  expect(createTemplate[0].children[0]).not.toHaveProperty("dataIndex");
});
it("imports numbers, normalized headers and date ranges from Excel", () => {
  const imported = importedDetailRows(createTemplate, [
    {
      key: 1,
      "Ghi chú chi tiết (*)": "Excel",
      "Số lượng": 0,
      "Từ ngày": "2026-10-20",
      "Đến ngày": "2026-10-21",
      "Khoảng ngày": "20/10/2026 - 22/10/2026",
      "Phương án": "",
    },
  ]);
  expect(imported[0].values).toMatchObject({
    f0: "Excel",
    f1: "0",
    f2: "20/10/2026",
    f4_start: "20/10/2026",
    f4_end: "22/10/2026",
  });
});
it("rejects an empty workbook, wrong headers and duplicate Excel row IDs", () => {
  expect(() => importedDetailRows(createTemplate, [])).toThrow(
    "không có dữ liệu",
  );
  expect(() =>
    importedDetailRows(createTemplate, [{ other: "wrong" }]),
  ).toThrow("không khớp");
  const headers = Object.fromEntries(
    createTemplate.flatMap((group) =>
      group.children.map((field) => [field.title, ""]),
    ),
  );
  expect(() =>
    importedDetailRows(createTemplate, [
      { ...headers, STT: 1, "Số lượng": 2 },
      { ...headers, STT: "1", "Số lượng": 3 },
    ]),
  ).toThrow("bị trùng");
});
it("normalizes native Excel datetime cells and preserves invalid dates for validation", () => {
  const groups = [
    {
      title: "Ngày",
      children: [{ title: "Ngày mốc", type: "date-text" }],
    },
  ];
  const rows = importedDetailRows(groups, [
    { "Ngày mốc": "2026-10-22 00:00:00" },
    { "Ngày mốc": "2026-02-30 00:00:00" },
    { "Ngày mốc": "2026-10-22 25:00:00" },
  ]);
  expect(rows.map((row) => row.values.f0)).toEqual([
    "22/10/2026",
    "2026-02-30 00:00:00",
    "2026-10-22 25:00:00",
  ]);
  expect(validateDetailRows(groups, rows)).toHaveLength(2);
});
it("validates title, notes, past due dates and empty detail rows", () => {
  const schema = getCreateRequestSchema(createTemplate);
  const data = values();
  data.title = "x".repeat(301);
  data.description = "x".repeat(1001);
  data.duedate = "01/01/2000";
  data.rows = [];
  const result = schema.safeParse(data);
  expect(result.success).toBe(false);
  if (!result.success)
    expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(["title", "description", "duedate", "rows"]),
    );
});
it("does not serialize a detail field that would overwrite the reserved row key", () => {
  const groups = structuredClone(createTemplate);
  groups[0].children[0].title = "key";
  expect(() => serializeRequestDetails(groups, [filledDetail])).toThrow(
    "dành riêng",
  );
});

it("validates only enabled creation sections and skips required fields in hidden sections", () => {
  const data = values();
  expect(
    getCreateRequestSchema(createMultiSectionTemplate).safeParse(data).success,
  ).toBe(true);
  expect(
    validateDetailRows(createMultiSectionTemplate, data.rows).map(
      (issue) => issue.message,
    ),
  ).toEqual([
    "Vui lòng nhập Kết quả xử lý.",
    "Vui lòng nhập Ngày xử lý.",
    "Vui lòng nhập Kết quả nghiệm thu.",
  ]);
  data.rows[0].values.f0 = "";
  const invalid = getCreateRequestSchema(createMultiSectionTemplate).safeParse(
    data,
  );
  expect(invalid.success).toBe(false);
  if (!invalid.success)
    expect(invalid.error.issues.map((issue) => issue.message)).toEqual([
      "Vui lòng nhập Ghi chú chi tiết.",
    ]);
});

it("keeps every section header but sends later section values blank even if supplied by the caller", () => {
  const groups = structuredClone(createMultiSectionTemplate);
  const snapshot = structuredClone(groups);
  const row = {
    values: {
      ...filledDetail.values,
      f6: "Forged result",
      f7: "21/10/2026",
      f8: "Forged approval",
    },
  };
  const data = serializeCreateRequestDetails(groups, [row, row]);
  expect(data.dataform?.header).toHaveLength(3);
  expect(data.dataform?.header).toEqual(data.dataform?.original_header);
  expect(data.dataform?.header[1]).toMatchObject({
    title: "Phần bộ phận xử lý",
    editable: false,
    children: [
      { title: "Kết quả xử lý", required: true },
      {
        title: "Ngày xử lý",
        required: true,
        validate: { operator: ">=", target: "Từ ngày" },
      },
    ],
  });
  for (const [index, record] of data.dataform!.data.entries())
    expect(record).toMatchObject({
      key: index + 1,
      "Ghi chú chi tiết": "Nội dung mẫu",
      "Khoảng ngày": "20/10/2026 - 22/10/2026",
      "Kết quả xử lý": "",
      "Ngày xử lý": "",
      "Kết quả nghiệm thu": "",
    });
  expect(groups).toEqual(snapshot);
  expect(row.values.f6).toBe("Forged result");
  expect(serializeCreateRequestDetails([], [])).toEqual({});
});

it("defers date comparisons against later sections while preserving their rules in the full template", () => {
  const groups = structuredClone(createMultiSectionTemplate);
  groups[0].children[2].validate = { operator: "<=", target: "Ngày xử lý" };
  const snapshot = structuredClone(groups);
  const initial = getCreateRequestGroups(groups);
  expect(initial).toHaveLength(1);
  expect(initial[0].children[2].validate).toBeUndefined();
  expect(initial[0].children[3].validate).toEqual({
    operator: ">=",
    target: "Từ ngày",
  });
  expect(getCreateRequestSchema(groups).safeParse(values()).success).toBe(true);
  const fields = detailFields(initial);
  expect(
    isDetailDateDisabled(
      new Date(2026, 9, 20),
      fields[2],
      filledDetail,
      fields,
    ),
  ).toBe(false);
  expect(
    serializeCreateRequestDetails(groups, [filledDetail]).dataform?.header[0]
      .children[2].validate,
  ).toEqual({ operator: "<=", target: "Ngày xử lý" });
  expect(groups).toEqual(snapshot);
  expect(getCreateRequestGroups([])).toEqual([]);
});

it("uses enabled sections in template order even when the first section is hidden", () => {
  const groups = structuredClone(createMultiSectionTemplate);
  groups[0].editable = false;
  groups[1].editable = true;
  const visible = getCreateRequestGroups(groups);
  expect(visible.map((group) => group.title)).toEqual(["Phần bộ phận xử lý"]);
  expect(visible[0].children[1].validate).toBeUndefined();
  const data = values();
  data.rows = importedDetailRows(visible, [
    {
      "Kết quả xử lý": "Đã xử lý",
      "Ngày xử lý": "2026-10-21",
      "Kết quả nghiệm thu": "Forged approval",
    },
  ]);
  data.rows[0].values.f8 = "Forged approval";
  expect(getCreateRequestSchema(groups).safeParse(data).success).toBe(true);
  expect(
    serializeCreateRequestDetails(groups, data.rows).dataform?.data,
  ).toEqual([
    {
      key: 1,
      "Ghi chú chi tiết": "",
      "Số lượng": "",
      "Từ ngày": "",
      "Đến ngày": "",
      "Khoảng ngày": "",
      "Phương án": "",
      "Kết quả xử lý": "Đã xử lý",
      "Ngày xử lý": "21/10/2026",
      "Kết quả nghiệm thu": "",
    },
  ]);
});

it("maps dates and ranges across multiple enabled sections without shifting data into hidden sections", () => {
  const groups = structuredClone(createMultiSectionTemplate);
  groups[2].editable = true;
  groups[2].children.push(
    { title: "Khoảng nghiệm thu", type: "range-date-text", required: true },
    {
      title: "Ngày nghiệm thu",
      type: "date-text",
      required: true,
      validate: { operator: ">=", target: "Từ ngày" },
    },
  );
  const data = values();
  data.rows[0].values = {
    ...filledDetail.values,
    f6: "Đã nghiệm thu",
    f7_start: "22/10/2026",
    f7_end: "23/10/2026",
    f8: "22/10/2026",
  };
  expect(getCreateRequestGroups(groups).map((group) => group.title)).toEqual([
    "Nội dung chi tiết",
    "Phần nghiệm thu",
  ]);
  expect(getCreateRequestSchema(groups).safeParse(data).success).toBe(true);
  expect(
    serializeCreateRequestDetails(groups, data.rows).dataform?.data[0],
  ).toMatchObject({
    "Ghi chú chi tiết": "Nội dung mẫu",
    "Kết quả xử lý": "",
    "Ngày xử lý": "",
    "Kết quả nghiệm thu": "Đã nghiệm thu",
    "Khoảng nghiệm thu": "22/10/2026 - 23/10/2026",
    "Ngày nghiệm thu": "22/10/2026",
  });
  data.rows[0].values.f8 = "19/10/2026";
  const invalid = getCreateRequestSchema(groups).safeParse(data);
  expect(invalid.success).toBe(false);
  if (!invalid.success)
    expect(invalid.error.issues.map((issue) => issue.message)).toContain(
      "Ngày phải >= Từ ngày.",
    );
});

it("supports templates with no enabled sections and preserves legacy sections without the editable flag", () => {
  const hidden = createMultiSectionTemplate.map((group) => ({
    ...group,
    editable: false,
  }));
  expect(getCreateRequestGroups(hidden)).toEqual([]);
  const data = values();
  expect(getCreateRequestSchema(hidden).safeParse(data).success).toBe(true);
  const serialized = serializeCreateRequestDetails(hidden, data.rows);
  expect(serialized.dataform?.header).toHaveLength(3);
  const record: Record<string, unknown> = serialized.dataform!.data[0];
  expect(
    Object.entries(record)
      .filter(([key]) => key !== "key")
      .every(([, value]) => value === ""),
  ).toBe(true);
  const legacy = structuredClone(createTemplate);
  delete legacy[0].editable;
  expect(getCreateRequestGroups(legacy)).toHaveLength(1);
  expect(getCreateRequestSchema(legacy).safeParse(data).success).toBe(true);
});

it.each([
  ["A".repeat(19), true],
  ["A".repeat(20), false],
  ["Đ".repeat(19), true],
  ["🙂".repeat(19), true],
  ["🙂".repeat(20), false],
  ["TEST_20261020_G3CCBK Group OK", false],
  ["A".repeat(19) + " ", false],
])(
  "validates the generated ticket code boundary for handling group %s",
  (name, valid) => {
    const schema = getCreateRequestSchema(createTemplate, [
      { id: 5, name },
      { id: 6, name: "B".repeat(30) },
    ]);
    const result = schema.safeParse(values());
    expect(result.success).toBe(valid);
    if (!result.success)
      expect(result.error.issues).toEqual([
        expect.objectContaining({
          path: ["handling_group"],
          message: expect.stringContaining("19 ký tự"),
        }),
      ]);
  },
);
