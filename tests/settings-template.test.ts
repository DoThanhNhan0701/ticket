import { expect, it } from "vitest";
import {
  prepareTemplate,
  templateResponseSchema,
} from "@/features/settings/schemas/template-schema";
import {
  getSettingsDefaults,
  getSettingsFormSchema,
} from "@/features/settings/utils/settings-form";
import { templateFixture } from "./fixtures/settings";

function groups() {
  return templateResponseSchema.parse(templateFixture).forms;
}
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
