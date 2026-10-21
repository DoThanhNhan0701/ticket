import { expect, it } from "vitest";
import { isRequestOverdue } from "@/features/requests/utils/request-overdue";

const now = new Date(2026, 9, 21, 12);
it.each([1, 2, 3, 6])(
  "highlights due-today and past tickets in status %i",
  (ticket_status) => {
    expect(
      isRequestOverdue({ duedate: "2026-10-21", ticket_status }, now),
    ).toBe(true);
    expect(
      isRequestOverdue({ duedate: "2026-10-20", ticket_status }, now),
    ).toBe(true);
    expect(
      isRequestOverdue({ duedate: "2026-10-22", ticket_status }, now),
    ).toBe(false);
  },
);
it.each([4, 5, 7])(
  "excludes terminal status %i even when overdue",
  (ticket_status) => {
    expect(
      isRequestOverdue({ duedate: "2020-01-01", ticket_status }, now),
    ).toBe(false);
  },
);
it.each(["", "not-a-date", "2026-02-30"])(
  "does not highlight an invalid date %s",
  (duedate) => {
    expect(isRequestOverdue({ duedate, ticket_status: 2 }, now)).toBe(false);
  },
);
it("compares the exact instant, including timezone offsets and equality", () => {
  const instant = new Date("2026-10-21T12:00:00+07:00");
  expect(
    isRequestOverdue(
      { duedate: "2026-10-21T05:00:00Z", ticket_status: 3 },
      instant,
    ),
  ).toBe(true);
  expect(
    isRequestOverdue(
      { duedate: "2026-10-21T12:00:01+07:00", ticket_status: 3 },
      instant,
    ),
  ).toBe(false);
});
