import { expect, it } from "vitest";
import {
  prepareTemplate,
  templateResponseSchema,
} from "@/features/settings/schemas/template-schema";
import {
  getSettingsDefaults,
  getSettingsFormSchema,
} from "@/features/settings/utils/settings-form";
import { getPositionPermissionOptions } from "@/features/settings/utils/position-permissions";
import { templateFixture } from "./fixtures/settings";
import {
  updateTemplateField,
  removeTemplateField,
  removeTemplateGroup,
} from "@/features/settings/utils/template";

function groups() {
  return templateResponseSchema.parse(templateFixture).forms;
}

it("blocks new retired permission grants while preserving or removing existing assignments", () => {
  const permissions = [
    { id: 1, name: "can_create", is_active: true },
    { id: 5, name: "can_search", is_active: true },
    { id: 7, name: "can_delete", is_active: true },
  ];
  const lookups = { "position-permissions": permissions };
  const existing = {
    id: 99,
    name: "Legacy position",
    is_active: true,
    permission: [5],
  };
  const values = getSettingsDefaults(existing);
  expect(getPositionPermissionOptions(permissions, [])).toEqual([
    { value: "1", label: "Tạo yêu cầu" },
  ]);
  expect(getPositionPermissionOptions(permissions, ["5"])).toEqual([
    { value: "1", label: "Tạo yêu cầu" },
    { value: "5", label: "Tìm kiếm yêu cầu (Ngừng cấp mới)" },
  ]);
  expect(
    getSettingsFormSchema("positions", false, lookups).safeParse(values)
      .success,
  ).toBe(false);
  const schema = getSettingsFormSchema("positions", true, lookups, existing);
  expect(schema.safeParse(values).success).toBe(true);
  expect(schema.safeParse({ ...values, permission: [] }).success).toBe(true);
  expect(schema.safeParse({ ...values, permission: ["5", "7"] }).success).toBe(
    false,
  );
});
it.each(["0", "-10", "50.5", "abc"])(
  "rejects invalid column width %s",
  (width) => {
    const forms = groups();
    forms[0].children[0].widthcol = width;
    expect(() => prepareTemplate(forms)).toThrow(
      "Độ rộng cột phải là số nguyên dương.",
    );
  },
);
it.each(["Ngày bắt đầu", "Ngày không tồn tại"])(
  "rejects self-referencing or dangling date rule %s",
  (target) => {
    const forms = groups();
    forms[0].children[0].validate = { target, operator: ">=" };
    expect(() => prepareTemplate(forms)).toThrow(/Điều kiện ngày/);
  },
);
it("rejects duplicate section and field titles", () => {
  const sections = groups();
  expect(() => prepareTemplate([...sections, ...sections])).toThrow(/Tên phần/);
  const fields = groups();
  fields[0].children.push({
    ...fields[0].children[0],
    title: "ngày bắt đầu (*)",
  });
  expect(() => prepareTemplate(fields)).toThrow(/Tên trường/);
});
it("cleans legacy markers and choices while preserving custom template values", () => {
  const forms = groups();
  forms[0].children[0].title = "Ngày bắt đầu (*)";
  forms[0].children[1].validate = {
    operator: ">=",
    target: "Ngày bắt đầu (*)",
  };
  forms[0].children[0].option = [" one ", "", [1, " two "]];
  const parsed = prepareTemplate(forms);
  expect(parsed[0].children[0]).toMatchObject({
    title: "Ngày bắt đầu",
    option: ["one", "two"],
    customSetting: "preserve",
  });
  expect(parsed[0].children[1].validate).toEqual({
    target: "Ngày bắt đầu",
    operator: ">=",
  });
});
it("rejects a forged related ID before submitting a settings form", () => {
  const schema = getSettingsFormSchema("teams", false, {
    "requesting-departments": [{ id: 20, name: "Department", is_active: true }],
  });
  const values = { ...getSettingsDefaults(), name: "Team", bophan: "999" };
  const parsed = schema.safeParse(values);
  expect(parsed.success).toBe(false);
  if (!parsed.success)
    expect(
      parsed.error.issues.some((issue) => issue.path[0] === "bophan"),
    ).toBe(true);
});

it("keeps date comparisons across sections when a target is renamed without mutating the original", () => {
  const original = groups();
  const start = original[0].children.shift()!;
  original.unshift({ title: "Mốc ngày", children: [start] });
  const updated = updateTemplateField(original, 0, 0, {
    ...start,
    title: " Ngày bắt đầu mới (*) ",
  });
  expect(prepareTemplate(updated)[1].children[0].validate).toEqual({
    operator: ">=",
    target: "Ngày bắt đầu mới",
  });
  expect(updated[0].children[0].customSetting).toBe("preserve");
  expect(original[1].children[0].validate).toEqual({
    operator: ">=",
    target: "Ngày bắt đầu",
  });
});

it("clears comparisons when a referenced date is deleted or changed to text", () => {
  const original = groups();
  const removed = removeTemplateField(original, 0, 0);
  expect(prepareTemplate(removed)[0].children[0].validate).toBeNull();
  const changed = updateTemplateField(original, 0, 0, {
    ...original[0].children[0],
    type: "text",
  });
  expect(prepareTemplate(changed)[0].children[1].validate).toBeNull();
  expect(changed[0].children[0].validate).toBeNull();
});

it("clears a date field's own comparison when its type changes", () => {
  const original = groups();
  const changed = updateTemplateField(original, 0, 1, {
    ...original[0].children[1],
    type: "number",
  });
  expect(prepareTemplate(changed)[0].children[1].validate).toBeNull();
});

it("clears dangling cross-section comparisons when a whole section is removed", () => {
  const original = groups();
  const start = original[0].children.shift()!;
  original.unshift({ title: "Mốc ngày", children: [start] });
  const removed = removeTemplateGroup(original, 0);
  expect(prepareTemplate(removed)[0].children[0].validate).toBeNull();
});

it("clears comparisons when a target name is erased and preserves them for non-name edits", () => {
  const original = groups();
  const changed = updateTemplateField(original, 0, 0, {
    ...original[0].children[0],
    required: false,
  });
  expect(changed[0].children[1].validate).toEqual(
    original[0].children[1].validate,
  );
  const erased = updateTemplateField(original, 0, 0, {
    ...original[0].children[0],
    title: " ",
  });
  expect(erased[0].children[1].validate).toBeNull();
});

it("blocks new inactive permission grants but preserves existing ones on edit", () => {
  const lookups = {
    "position-permissions": [{ id: 4, name: "can_view", is_active: false }],
  };
  const record = {
    id: 99,
    name: "Inactive grant",
    is_active: true,
    permission: [4],
  };
  const values = getSettingsDefaults(record);
  expect(
    getPositionPermissionOptions(lookups["position-permissions"], []),
  ).toEqual([]);
  expect(
    getSettingsFormSchema("positions", false, lookups).safeParse(values)
      .success,
  ).toBe(false);
  const editing = getSettingsFormSchema("positions", true, lookups, record);
  expect(editing.safeParse(values).success).toBe(true);
  expect(editing.safeParse({ ...values, permission: [] }).success).toBe(true);
});
