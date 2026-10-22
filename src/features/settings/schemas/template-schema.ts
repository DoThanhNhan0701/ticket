import { z } from "zod";

export const templateFieldSchema = z.looseObject({
  key: z.union([z.string(), z.number()]).optional(),
  title: z.string(),
  type: z.string(),
  required: z.boolean().optional(),
  handling: z.boolean().optional(),
  status: z.boolean().optional(),
  editable: z.boolean().optional(),
  widthcol: z.union([z.number(), z.string()]).optional(),
  width: z.union([z.number(), z.string()]).optional(),
  dataIndex: z.string().optional(),
  option: z
    .array(
      z.union([
        z.string(),
        z.tuple([z.union([z.string(), z.number()]), z.string()]),
      ]),
    )
    .optional(),
  validate: z.union([z.record(z.string(), z.unknown()), z.string()]).nullish(),
});
export const templateGroupSchema = z.looseObject({
  title: z.string(),
  editable: z.boolean().optional(),
  colortitle: z.string().optional(),
  children: z.array(templateFieldSchema),
});
export const templateResponseSchema = z.object({
  forms: z.array(templateGroupSchema),
});
export type TemplateField = z.infer<typeof templateFieldSchema>;
export type TemplateGroup = z.infer<typeof templateGroupSchema>;

export function cleanTemplateTitle(title: string) {
  return title.split("(*)").join("").trim();
}
function validateDateRules(groups: readonly TemplateGroup[]) {
  const fields = groups.flatMap((group) => group.children);
  for (const field of fields) {
    const rule = field.validate;
    if (
      typeof rule !== "object" ||
      rule === null ||
      (!rule.operator && !rule.target)
    )
      continue;
    const target = fields.find((other) => other.title === rule.target);
    if (
      ![">", ">=", "<", "<="].includes(String(rule.operator)) ||
      !target ||
      target === field ||
      !field.type.includes("date") ||
      !target.type.includes("date")
    ) {
      throw new Error(
        `Điều kiện ngày của trường ${field.title} không hợp lệ. Vui lòng chọn phép so sánh và trường ngày khác.`,
      );
    }
  }
}
export function normalizeTemplate(groups: readonly TemplateGroup[]) {
  return groups.map((group) => ({
    ...group,
    title: cleanTemplateTitle(group.title),
    children: group.children.map((field) => {
      const rule = field.validate;
      const validate =
        typeof rule === "object" &&
        rule !== null &&
        typeof rule.target === "string"
          ? { ...rule, target: cleanTemplateTitle(rule.target) }
          : rule;
      const options = field.option
        ?.map((value) => (Array.isArray(value) ? value[1] : value))
        .map((value) => value.trim())
        .filter(Boolean);
      return {
        ...field,
        title: cleanTemplateTitle(field.title),
        ...(options ? { option: options } : {}),
        ...(validate !== undefined ? { validate } : {}),
      };
    }),
  }));
}

export function prepareTemplate(groups: readonly TemplateGroup[]) {
  if (!groups.length)
    throw new Error("Vui lòng thêm ít nhất một phần biểu mẫu.");
  const groupNames = new Set<string>();
  const fieldNames = new Set<string>();
  const cleaned = normalizeTemplate(groups).map((group) => ({
    ...group,
    children: group.children.map((field) => ({
      ...field,
      required: field.required === true,
      handling: field.handling === true,
      status: field.status === true,
    })),
  }));
  for (const group of cleaned) {
    const title = group.title;
    if (!title || groupNames.has(title.toLowerCase()))
      throw new Error("Tên phần phải có nội dung và không trùng nhau.");
    if (!group.children.length)
      throw new Error(`Vui lòng thêm trường cho phần ${title}.`);
    groupNames.add(title.toLowerCase());
    for (const field of group.children) {
      const name = field.title;
      if (!name || fieldNames.has(name.toLowerCase()))
        throw new Error("Tên trường phải có nội dung và không trùng nhau.");
      fieldNames.add(name.toLowerCase());
      if (
        field.widthcol !== undefined &&
        (!/^\d+$/.test(String(field.widthcol)) || Number(field.widthcol) <= 0)
      )
        throw new Error("Độ rộng cột phải là số nguyên dương.");
    }
  }
  validateDateRules(cleaned);
  return cleaned;
}
