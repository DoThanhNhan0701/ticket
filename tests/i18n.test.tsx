// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "@babel/parser";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  getLocale,
  i18n,
  localeStorageKey,
  setLocale,
  t,
  translateMessage,
} from "@/i18n";
import { LanguageSwitch } from "@/components/language-switch";
import { DataPagination } from "@/components/data-management/data-pagination";
import { LoadingState } from "@/components/loading-state";
import { SearchInput } from "@/components/search-input";
import { reportNumberFormat } from "@/features/reports/utils/report-chart";
import { RecruitmentChart } from "@/features/recruitment/components/recruitment-chart";
import { LoginPage } from "@/pages/login";
import { FieldError } from "@/components/ui/field";
import {
  allRequestFilterFields,
  personalTaskFilterFields,
  allTaskFilterFields,
} from "@/features/requests/types";
import { settingsConfig } from "@/features/settings/utils/settings-config";
import { buildTicketActionPlan } from "@/features/requests/utils/ticket-actions";
import { requestDetailFixture } from "./fixtures/request-detail";
import { requestDetailSchema } from "@/features/requests/schemas/request-detail-schema";
import {
  parseGuideHtml,
  convertGuideDocument,
} from "@/features/help/api/user-guide-api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLocale("vi");
  localStorage.removeItem(localeStorageKey);
});

it("reacts to library language changes and supports namespace fallback", async () => {
  render(<LanguageSwitch />);
  await act(async () => {
    await i18n.changeLanguage("en");
  });
  expect(screen.getByRole("combobox", { name: "Language" })).toBeTruthy();
  expect(localStorage.getItem(localeStorageKey)).toBe("en");
  expect(document.documentElement.lang).toBe("en");
  expect(t("missing-page", "missing.key: text")).toBe("missing.key: text");
  expect(t("common", "{0}", ["<b>{1}</b> $t(other)"])).toBe(
    "<b>{1}</b> $t(other)",
  );
  expect(i18n.hasResourceBundle("en", "request-create")).toBe(true);
});

it("defaults to Vietnamese and persists a reactive choice without resetting form input", async () => {
  expect(getLocale()).toBe("vi");
  render(
    <LoginPage
      onLogin={vi.fn()}
      isLoading={false}
      error={null}
      setError={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText(/^Tên đăng nhập/), {
    target: { value: "draft.user" },
  });
  fireEvent.click(screen.getByRole("combobox", { name: "Ngôn ngữ" }));
  fireEvent.keyDown(await screen.findByRole("option", { name: "English" }), {
    key: "Enter",
  });
  expect(screen.getByLabelText(/^Username/).getAttribute("value")).toBe(
    "draft.user",
  );
  expect(
    screen.getByRole("button", { name: "Sign In to Ticket" }),
  ).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
  expect(localStorage.getItem(localeStorageKey)).toBe("en");
  fireEvent.click(screen.getByRole("combobox", { name: "Language" }));
  fireEvent.keyDown(await screen.findByRole("option", { name: "Tiếng Việt" }), {
    key: "Enter",
  });
  expect(screen.getByLabelText(/^Tên đăng nhập/).getAttribute("value")).toBe(
    "draft.user",
  );
});

it("supports blocked storage and synchronizes preferences changed in another tab", () => {
  render(<LanguageSwitch />);
  const blocked = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("blocked");
    });
  act(() => setLocale("en"));
  expect(screen.getByRole("combobox", { name: "Language" })).toBeTruthy();
  blocked.mockRestore();
  localStorage.setItem(localeStorageKey, "invalid");
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", { key: localeStorageKey }),
    ),
  );
  expect(getLocale()).toBe("vi");
  expect(document.documentElement.lang).toBe("vi");
});

it("updates existing validation errors and preserves interpolation values", () => {
  render(<FieldError errors={[{ message: "Username is required." }]} />);
  expect(screen.getByText("Vui lòng nhập tên đăng nhập.")).toBeTruthy();
  act(() => setLocale("en"));
  expect(screen.getByText("Username is required.")).toBeTruthy();
  expect(translateMessage("Tệp “Báo cáo.xlsx” vượt quá 50 MB.")).toBe(
    "File “Báo cáo.xlsx” exceeds 50 MB.",
  );
  expect(translateMessage("Unknown backend message")).toBe(
    "Unknown backend message",
  );
  expect(t("common", "toString")).toBe("toString");
  expect(translateMessage("Vui lòng nhập tên bộ phận.")).toBe(
    "Please enter department name.",
  );
  expect(t("request-create", "Nhập {0}", ["Nội dung do người dùng tạo"])).toBe(
    "Enter Nội dung do người dùng tạo",
  );
});

it("does not freeze derived filter labels or settings labels at module import", () => {
  setLocale("en");
  expect(
    allRequestFilterFields.find((f) => f.name === "ticket_type_id")?.label,
  ).toBe("Request type");
  expect(
    personalTaskFilterFields.find((f) => f.name === "ticket_type_name")
      ?.placeholder,
  ).toBe("Select request type");
  expect(
    allTaskFilterFields.find((f) => f.name === "ticket_type_id")?.label,
  ).toBe("Request type");
  expect(
    personalTaskFilterFields.find((f) => f.name === "typeView")?.options?.[0]
      .label,
  ).toBe("All");
  expect(settingsConfig.offices.fields[0].label).toBe("Office name");
  setLocale("vi");
  expect(settingsConfig.offices.fields[0].label).toBe("Tên văn phòng");
});

it("keeps action protocol values unchanged in English", () => {
  setLocale("en");
  const values = {
    reason: "",
    mode: "",
    users: [],
    oldUser: "",
    newUser: "",
    replacements: [],
  };
  const ticket = requestDetailSchema.parse({
    ...requestDetailFixture,
    list_button: { "Phê duyệt": "Approve" },
  });
  const plan = buildTicketActionPlan(ticket, "Phê duyệt", values);
  expect(plan[0].endpoint).toBe("/accept_ticket/");
  expect(plan[0].body).toEqual({ ticket_id: ticket.id });
});

it("keeps matching keys and placeholders across every page catalog", () => {
  const root = resolve("src/locales");
  const files = readdirSync(`${root}/vi`).sort();
  expect(files).toEqual(readdirSync(`${root}/en`).sort());
  expect(files.length).toBeGreaterThan(25);
  for (const file of files) {
    const viCatalog = JSON.parse(
      readFileSync(`${root}/vi/${file}`, "utf8"),
    ) as Record<string, string>;
    const enCatalog = JSON.parse(
      readFileSync(`${root}/en/${file}`, "utf8"),
    ) as Record<string, string>;
    expect(Object.keys(enCatalog).sort(), file).toEqual(
      Object.keys(viCatalog).sort(),
    );
    for (const [key, text] of Object.entries(enCatalog)) {
      expect(text.trim(), `${file}: ${key}`).not.toBe("");
      expect(text.match(/\{\d+\}/g)?.sort() ?? [], `${file}: ${key}`).toEqual(
        key.match(/\{\d+\}/g)?.sort() ?? [],
      );
      expect(text, `${file}: ${key}`).not.toMatch(/[À-ỹĐđ]/);
    }
  }
});

it("provides the same 15 chapters in the English web and downloadable guides", async () => {
  const html = readFileSync(
    resolve("public/docs/Rainscales-Ticket-User-Guide.html"),
    "utf8",
  );
  const web = parseGuideHtml(html);
  const bytes = Uint8Array.from(
    readFileSync(resolve("public/docs/Rainscales-Ticket-User-Guide.docx")),
  ).buffer;
  const word = await convertGuideDocument(bytes);
  expect(web.chapters).toHaveLength(15);
  expect(word.chapters.map((c) => c.title)).toEqual(
    web.chapters.map((c) => c.title),
  );
  expect(web.version).toBe("1.2");
  expect(web.chapters[3].html).toContain("4.10. Complete example");
  expect(web.chapters[14].html).toContain("15.5. What to give support");
});

it("translates pagination, shared controls and number formats without remounting", () => {
  render(
    <>
      <DataPagination
        count={100}
        page={1}
        pageSize={20}
        pageSizes={[20, 50]}
        onPage={vi.fn()}
        onPageSize={vi.fn()}
      />
      <LoadingState />
      <SearchInput label="Tickets" value="draft" onValueChange={vi.fn()} />
    </>,
  );
  expect(screen.getByTitle("20 / trang")).toBeTruthy();
  expect(screen.getByText("Đang tải...")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Xóa tickets" })).toBeTruthy();
  expect(reportNumberFormat.format(1234.5)).toBe("1.234,5");
  act(() => setLocale("en"));
  expect(screen.getByTitle("20 / page")).toBeTruthy();
  expect(screen.getByText("Loading...")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Clear tickets" })).toBeTruthy();
  expect(reportNumberFormat.format(1234.5)).toBe("1,234.5");
});

it("translates retained field and settings errors without changing user-provided names", () => {
  setLocale("en");
  expect(translateMessage("Tiêu đề yêu cầu is required.")).toBe(
    "Request title is required.",
  );
  expect(translateMessage("Dữ liệu người dùng không hợp lệ.")).toBe(
    "Invalid users data.",
  );
  expect(translateMessage("Tệp không được vượt quá 10 MB.")).toBe(
    "The file must not exceed 10 MB.",
  );
  expect(
    translateMessage("Vui lòng thêm trường cho phần Nội dung riêng."),
  ).toBe("Please add fields to section Nội dung riêng.");
  expect(parseGuideHtml("<p>English guide</p>", "en").chapters[0].title).toBe(
    "User guide",
  );
});

it("translates status chart categories without translating custom department names", () => {
  setLocale("en");
  render(
    <>
      <RecruitmentChart
        section="result_cv_status"
        rows={[{ cv_status__name: "Chờ phỏng vấn", number_cv: 2 }]}
      />
      <RecruitmentChart
        section="result_department"
        rows={[{ department_recruited: "Chờ phỏng vấn", number_cv: 3 }]}
      />
    </>,
  );
  expect(screen.getByText("Awaiting interview")).toBeTruthy();
  expect(screen.getByText("Chờ phỏng vấn")).toBeTruthy();
});

it("has translations for literal calls and no untranslated visible JSX text", () => {
  const catalogs: Record<string, Record<string, string>> = {};
  for (const file of readdirSync(resolve("src/locales/en"))) {
    catalogs[file.replace(/\.json$/, "")] = JSON.parse(
      readFileSync(resolve("src/locales/en", file), "utf8"),
    );
  }
  function checkDirectory(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        checkDirectory(path);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const ast = parse(readFileSync(path, "utf8"), {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
      });
      function walk(value: unknown) {
        if (!value || typeof value !== "object") return;
        const node = value as Record<string, unknown>;
        if (node.type === "JSXText") {
          expect(String(node.value), path).not.toMatch(/[a-zA-Z\u00c0-\u1ef9]/);
        }
        if (
          node.type === "CallExpression" &&
          (node.callee as { name?: string })?.name === "t"
        ) {
          const [namespace, key] = node.arguments as {
            type: string;
            value: string;
          }[];
          if (
            namespace?.type === "StringLiteral" &&
            key?.type === "StringLiteral"
          ) {
            expect(
              Object.prototype.hasOwnProperty.call(
                catalogs[namespace.value] ?? {},
                key.value,
              ) ||
                Object.prototype.hasOwnProperty.call(
                  catalogs.common,
                  key.value,
                ),
              `${path}: ${namespace.value}/${key.value}`,
            ).toBe(true);
          }
        }
        for (const [key, child] of Object.entries(node)) {
          if (key === "loc") continue;
          if (Array.isArray(child)) child.forEach(walk);
          else if (typeof child === "object") walk(child);
        }
      }
      walk(ast);
    }
  }
  checkDirectory(resolve("src"));
});
