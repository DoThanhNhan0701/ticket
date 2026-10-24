import { t } from "@/i18n";
import { format, isValid, parse, startOfDay } from "date-fns";
import {
  cleanTemplateTitle,
  type TemplateField,
  type TemplateGroup,
} from "@/features/settings/schemas/template-schema";
import type { DetailRow } from "../schemas/create-request-schema";

export function getCreateRequestGroups(groups: readonly TemplateGroup[]) {
  const visible = groups.filter((group) => group.editable !== false);
  const titles = new Set(
    visible.flatMap((group) =>
      group.children.map((field) => cleanTemplateTitle(field.title)),
    ),
  );
  return visible.map((group) => ({
    ...group,
    children: group.children.map((field) => {
      const rule = field.validate;
      // Comparisons with sections completed later cannot constrain creation.
      if (
        typeof rule === "object" &&
        rule !== null &&
        typeof rule.target === "string" &&
        !titles.has(cleanTemplateTitle(rule.target))
      )
        return { ...field, validate: undefined };
      return field;
    }),
  }));
}

export function parseRequestDate(value: string) {
  if (!/^(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/.test(value.trim()))
    return undefined;
  const date = parse(
    value.trim(),
    value.includes("-") ? "yyyy-MM-dd" : "d/M/yyyy",
    new Date(),
  );
  return isValid(date) ? date : undefined;
}
export function detailFields(groups: readonly TemplateGroup[]) {
  let index = 0;
  return groups.flatMap((group, groupIndex) =>
    group.children.map((field) => ({
      ...field,
      title: cleanTemplateTitle(field.title),
      fieldKey: `f${index++}`,
      groupIndex,
    })),
  );
}
export function fieldOptions(field: TemplateField) {
  return (field.option ?? [])
    .map((option) => (Array.isArray(option) ? option[1] : option).trim())
    .filter(Boolean);
}

export function emptyDetailRow(groups: readonly TemplateGroup[]): DetailRow {
  return {
    values: Object.fromEntries(
      detailFields(groups).flatMap((field) => {
        if (field.type === "range-date-text" && !fieldOptions(field).length)
          return [
            [`${field.fieldKey}_start`, ""],
            [`${field.fieldKey}_end`, ""],
          ];
        return [[field.fieldKey, ""]];
      }),
    ),
  };
}
export function detailValue(
  field: ReturnType<typeof detailFields>[number],
  row: DetailRow,
) {
  const value = row.values[field.fieldKey] ?? "";
  if (fieldOptions(field).length) return value;
  if (field.type === "range-date-text") {
    const start = row.values[`${field.fieldKey}_start`] ?? "",
      end = row.values[`${field.fieldKey}_end`] ?? "";
    if (!start && !end) return "";
    return `${start} - ${end}`;
  }
  return value;
}
function fieldError(
  field: ReturnType<typeof detailFields>[number],
  row: DetailRow,
) {
  const value = detailValue(field, row).trim();
  if (!value)
    return field.required
      ? t("request-detail", "Vui lòng nhập {0}.", [field.title])
      : "";
  const options = fieldOptions(field);
  if (options.length)
    return options.includes(value)
      ? ""
      : t("request-detail", "Vui lòng chọn giá trị trong danh sách.");
  if (field.type === "number")
    return Number.isFinite(Number(value))
      ? ""
      : t("request-detail", "Vui lòng nhập số hợp lệ.");
  if (field.type === "date-text")
    return parseRequestDate(value)
      ? ""
      : t("request-detail", "Ngày không hợp lệ (DD/MM/YYYY).");
  if (field.type === "range-date-text")
    return rangeDateError(field.fieldKey, row);
  return "";
}
function rangeDateError(key: string, row: DetailRow) {
  const start = parseRequestDate(row.values[`${key}_start`] ?? "");
  const end = parseRequestDate(row.values[`${key}_end`] ?? "");
  return start && end && start <= end
    ? ""
    : t(
        "request-detail",
        "Vui lòng nhập đủ khoảng ngày hợp lệ, ngày kết thúc không trước ngày bắt đầu.",
      );
}
function comparisonError(
  field: ReturnType<typeof detailFields>[number],
  row: DetailRow,
  fields: ReturnType<typeof detailFields>,
) {
  const rule = field.validate;
  if (
    !field.type.includes("date") ||
    typeof rule !== "object" ||
    rule === null ||
    typeof rule.target !== "string"
  )
    return "";
  const target = fields.find(
    (other) => other.title === cleanTemplateTitle(String(rule.target)),
  );
  if (!target)
    return t(
      "request-detail",
      "Điều kiện so sánh ngày trong biểu mẫu không hợp lệ.",
    );
  const current = parseRequestDate(
    row.values[
      field.type === "range-date-text"
        ? `${field.fieldKey}_start`
        : field.fieldKey
    ] ?? "",
  );
  const other = parseRequestDate(
    row.values[
      target.type === "range-date-text"
        ? `${target.fieldKey}_start`
        : target.fieldKey
    ] ?? "",
  );
  if (!current || !other) return "";
  const comparisons: Record<string, boolean> = {
    ">": current > other,
    ">=": current >= other,
    "<": current < other,
    "<=": current <= other,
  };
  return comparisons[String(rule.operator)]
    ? ""
    : t("request-detail", "Ngày phải {0} {1}.", [
        String(rule.operator),
        target.title,
      ]);
}
export function isDetailDateDisabled(
  date: Date,
  field: ReturnType<typeof detailFields>[number],
  row: DetailRow,
  fields: ReturnType<typeof detailFields>,
  part: "start" | "end" = "start",
) {
  const day = startOfDay(date);
  const isRange = field.type === "range-date-text";
  if (isRange) {
    const boundary = parseRequestDate(
      row.values[`${field.fieldKey}_${part === "start" ? "end" : "start"}`] ??
        "",
    );
    if (boundary && (part === "start" ? day > boundary : day < boundary))
      return true;
    // A lower bound for the start also bounds the end of the range.
    if (part === "end" && !hasMinimumDateRule(field)) return false;
  }
  const key = isRange ? `${field.fieldKey}_start` : field.fieldKey;
  return Boolean(
    comparisonError(
      field,
      { values: { ...row.values, [key]: format(day, "dd/MM/yyyy") } },
      fields,
    ),
  );
}
function hasMinimumDateRule(field: TemplateField) {
  const rule = field.validate;
  return (
    typeof rule === "object" &&
    rule !== null &&
    [">", ">="].includes(String(rule.operator))
  );
}
export function validateDetailRows(
  groups: readonly TemplateGroup[],
  rows: readonly DetailRow[],
) {
  const fields = detailFields(groups);
  const issues: { path: (string | number)[]; message: string }[] = [];
  if (fields.length && !rows.length)
    issues.push({
      path: ["rows"],
      message: t("request-detail", "Vui lòng thêm ít nhất một dòng chi tiết."),
    });
  rows.forEach((row, index) =>
    fields.forEach((field) => {
      const error = fieldError(field, row);
      const message = error || comparisonError(field, row, fields);
      if (message) {
        let keys = [field.fieldKey];
        if (field.type === "range-date-text" && !fieldOptions(field).length) {
          keys = ["start", "end"]
            .map((part) => `${field.fieldKey}_${part}`)
            .filter((key) => !parseRequestDate(row.values[key] ?? ""));
          // Missing/invalid endpoints belong to their inputs. A reversed range
          // belongs to the end; a template comparison constrains the start.
          if (!keys.length)
            keys = [`${field.fieldKey}_${error ? "end" : "start"}`];
        }
        for (const key of keys)
          issues.push({
            path: ["rows", index, "values", key],
            message,
          });
      }
    }),
  );
  return issues;
}
export function serializeRequestDetails(
  groups: readonly TemplateGroup[],
  rows: readonly DetailRow[],
) {
  if (!groups.length) return {};
  const fields = detailFields(groups);
  if (fields.some((field) => field.title === "key"))
    throw new Error(
      t(
        "request-detail",
        "Biểu mẫu có tên trường dành riêng ‘key’. Vui lòng chỉnh lại cấu hình.",
      ),
    );
  const header = groups.map((group, groupIndex) => ({
    ...group,
    children: fields
      .filter((field) => field.groupIndex === groupIndex)
      .map(({ fieldKey: _key, groupIndex: _group, ...field }) => ({
        ...field,
        dataIndex: field.title,
        key: field.title,
        width: Number(field.widthcol) || 200,
        ellipsis: false,
        option: fieldOptions(field).length ? fieldOptions(field) : undefined,
      })),
  }));
  const data = rows.map((row, index) => ({
    ...Object.fromEntries(
      fields.map((field) => [field.title, detailValue(field, row)]),
    ),
    key: index + 1,
  }));
  return { dataform: { data, header, original_header: header } };
}
export function serializeCreateRequestDetails(
  groups: readonly TemplateGroup[],
  rows: readonly DetailRow[],
  ticketType?: number,
) {
  const blank = serializeRequestDetails(
    groups,
    rows.map(() => ({ values: {} })),
  );
  const dataform = blank.dataform;
  if (!dataform) return blank;
  const fields = detailFields(getCreateRequestGroups(groups));
  return {
    dataform: {
      ...dataform,
      data: rows.map((row, index) => {
        const values = Object.fromEntries(
          fields.map((field) => [field.title, detailValue(field, row)]),
        );
        // Recruitment approval still reads canonical names with the legacy (*)
        // suffix. Keep clean keys for rendering/imports and aliases at this API boundary.
        const legacy =
          ticketType === 99
            ? Object.fromEntries(
                Object.entries(values).map(([key, value]) => [
                  `${key} (*)`,
                  value,
                ]),
              )
            : {};
        return { ...dataform.data[index], ...values, ...legacy };
      }),
    },
  };
}
export function importedDetailRows(
  groups: readonly TemplateGroup[],
  data: readonly Record<string, string | number | null>[],
) {
  if (!data.length)
    throw new Error(t("request-detail", "Tệp Excel không có dữ liệu."));
  const fields = detailFields(groups),
    keys = new Set<string>();
  return data.map((row, index) => {
    const key = String(row.key ?? row.STT ?? index + 1);
    if (keys.has(key))
      throw new Error(t("request-detail", "STT trong tệp Excel bị trùng."));
    keys.add(key);
    const cells = new Map(
      Object.entries(row).map(([name, value]) => [
        cleanTemplateTitle(name),
        String(value ?? ""),
      ]),
    );
    if (!fields.every((field) => cells.has(field.title)))
      throw new Error(
        t("request-detail", "Tệp Excel không khớp biểu mẫu đã chọn."),
      );
    const values: Record<string, string> = {};
    for (const field of fields) {
      const value = cells.get(field.title) ?? "";
      if (field.type === "range-date-text" && !fieldOptions(field).length) {
        const [start = "", end = ""] = value.split(" - ");
        values[`${field.fieldKey}_start`] = dateDisplay(start);
        values[`${field.fieldKey}_end`] = dateDisplay(end);
      } else
        values[field.fieldKey] =
          field.type === "date-text" && !fieldOptions(field).length
            ? dateDisplay(value)
            : value;
    }
    return { values };
  });
}
function dateDisplay(value: string) {
  const date =
    parseRequestDate(value) ??
    parse(value.trim(), "yyyy-MM-dd HH:mm:ss", new Date());
  return isValid(date) ? format(date, "dd/MM/yyyy") : value;
}
