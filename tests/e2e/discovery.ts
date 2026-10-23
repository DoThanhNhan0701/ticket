import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import { APP_ROUTES } from "../../src/constants/routes";
import { navigationGroups, workspacePages } from "../../src/app/navigation";

export const menu = navigationGroups.flatMap((group) =>
  group.pages.map((page) => ({
    group: group.label,
    label: page.label,
    route: page.path,
    module: page.path.split("/")[1],
    permission: page.permission,
  })),
);
function componentFor(route: string) {
  if (route.startsWith("/settings")) return "SettingsList";
  if (route.startsWith("/recruitment")) return "Recruitment";
  if (route.startsWith("/reports")) return "ReportsPage";
  return "Requests";
}
export const routes = [
  ...workspacePages.map((page) => ({
    route: page.path,
    module: page.path.split("/")[1],
    component: componentFor(page.path),
    label: page.label,
    aliases: [...(page.legacyPaths || [])],
  })),
  ...[
    { route: APP_ROUTES.login, label: "Login", component: "LoginPage" },
    {
      route: APP_ROUTES.forbidden,
      label: "Forbidden",
      component: "ForbiddenPage",
    },
    { route: APP_ROUTES.help, label: "User guide", component: "GuideReader" },
    { route: APP_ROUTES.root, label: "Root redirect", component: "App" },
    { route: "*", label: "Unknown-route redirect", component: "App" },
  ].map((row) => ({
    ...row,
    module: row.route.split("/")[1] || "routing",
    aliases: [] as string[],
  })),
];
export interface StaticControl {
  id: string;
  file: string;
  line: number;
  module: string;
  component: string;
  tag: string;
  label: string;
  controlId: string;
  status?: string;
  reason?: string;
}
export function discoverControls() {
  const files: string[] = [];
  const walk = (directory: string) =>
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (file.endsWith(".tsx")) files.push(file);
    });
  ["src/features", "src/pages", "src/app/layouts", "src/components"].forEach(
    walk,
  );
  const controls: StaticControl[] = [];
  const interactive =
    /^(Button|AsyncButton|Input|Textarea|SearchInput|SearchableSelect|SelectField|MultiSelectField|DatePickerField|TimePickerField|Checkbox|CheckboxField|InputField|TextareaField|PasswordField|Link|NavLink|AppNavLink|button|input|textarea|select|a|summary)$/;
  files.forEach((file) => {
    const text = fs.readFileSync(file, "utf8");
    const source = parse(text, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });
    const visit = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const current = node as {
        type?: string;
        name?: { name?: string };
        loc?: { start: { line: number } };
        attributes?: {
          type: string;
          name?: { name?: string };
          value?: { type?: string; value?: string };
        }[];
      };
      const tag = current.name?.name || "";
      if (
        ["JSXSelfClosingElement", "JSXOpeningElement"].includes(
          current.type || "",
        ) &&
        interactive.test(tag)
      ) {
        const attributes = Object.fromEntries(
          (current.attributes || [])
            .filter((attribute) => attribute.type === "JSXAttribute")
            .map((attribute) => [
              attribute.name?.name || "",
              attribute.value?.type === "StringLiteral"
                ? attribute.value.value || ""
                : "",
            ]),
        );
        const line = current.loc?.start.line || 0;
        controls.push({
          id: `${file}:${line}`,
          file,
          line,
          module: file.split("/")[2] || "shared",
          component: path.basename(file, ".tsx"),
          tag,
          label:
            attributes["aria-label"] ||
            attributes.label ||
            attributes.title ||
            "",
          controlId: attributes.id || "",
        });
      }
      Object.values(node).forEach((value) => {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === "object") visit(value);
      });
    };
    visit(source);
  });
  return controls;
}
