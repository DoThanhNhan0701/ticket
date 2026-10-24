// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  CalendarCheck,
  Fingerprint,
  FolderOpen,
  FileSignature,
  LineChart,
  MessageSquare,
  Grid,
} from "lucide-react";
import { getProjectIcon } from "@/features/projects/utils/project-icon";
import { FieldError } from "@/components/ui/field";
import { getApiBaseUrl } from "@/lib/api/api-base-url";
import { formatDate } from "@/lib/utils";

afterEach(cleanup);

it.each([
  ["TICKET", CalendarCheck],
  ["Chấm công", Fingerprint],
  ["document", FolderOpen],
  ["tài sản", FileSignature],
  ["revenue", LineChart],
  ["chat", MessageSquare],
  ["unknown", Grid],
] as const)("keeps the project icon mapping for %s", (name, icon) => {
  expect(getProjectIcon(name, "fallback")).toBe(icon);
});

it("keeps icon priority and uses the project name only when no icon name is set", () => {
  expect(getProjectIcon("file-calendar", "chat")).toBe(CalendarCheck);
  expect(getProjectIcon("", "HR")).toBe(Fingerprint);
});

it("deduplicates validation messages and ignores missing error entries", () => {
  const view = render(
    <FieldError
      errors={[
        undefined,
        {},
        { message: "Required" },
        { message: "Required" },
        { message: "Invalid date" },
      ]}
    />,
  );
  const messages = within(screen.getByRole("alert")).getAllByRole("listitem");
  expect(messages.map((item) => item.textContent)).toEqual([
    "Bắt buộc",
    "Invalid date",
  ]);
  view.rerender(<FieldError errors={[undefined, {}]} />);
  expect(screen.queryByRole("alert")).toBeNull();
  view.rerender(
    <FieldError errors={[{ message: "Required" }]}>Custom message</FieldError>,
  );
  expect(screen.getByRole("alert").textContent).toBe("Custom message");
});

it("normalizes long trailing-slash inputs without backtracking", () => {
  expect(getApiBaseUrl(`https://example.test/api${"/".repeat(50000)}`)).toBe(
    "https://example.test/api",
  );
  expect(getApiBaseUrl("///")).toBe("/api");
});

it("keeps calendar dates independent of time-zone conversion", () => {
  expect(formatDate("2026-10-21T23:30:00-08:00")).toBe("21/10/2026");
  expect(formatDate("21/10/2026")).toBe("21/10/2026");
  expect(formatDate(null)).toBe("");
});
