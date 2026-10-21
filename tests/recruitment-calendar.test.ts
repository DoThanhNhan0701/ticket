import { expect, it } from "vitest";
import { layoutInterviews } from "@/features/recruitment/utils/interview-layout";
it("places overlapping interviews in separate lanes and reuses a free lane at the exact boundary", () => {
  const result = layoutInterviews([
    { id: 3, time_start: "10:00:00", time_end: "11:00:00" },
    { id: 1, time_start: "09:00:00", time_end: "10:00:00" },
    { id: 2, time_start: "09:30:00", time_end: "10:30:00" },
  ]);
  expect(result.map(({ row, lane, lanes }) => [row.id, lane, lanes])).toEqual([
    [1, 0, 2],
    [2, 1, 2],
    [3, 0, 2],
  ]);
  expect(result[2].start).toBe(600);
});
it("supports an empty calendar", () =>
  expect(layoutInterviews([])).toEqual([]));
it("restores full width after an overlapping group ends and keeps source order unchanged", () => {
  const rows = [
    { id: 3, time_start: "14:00:00", time_end: "15:00:00" },
    { id: 2, time_start: "09:30:00", time_end: "10:30:00" },
    { id: 1, time_start: "09:00:00", time_end: "10:00:00" },
  ];
  expect(
    layoutInterviews(rows).map(({ row, lanes }) => [row.id, lanes]),
  ).toEqual([
    [1, 2],
    [2, 2],
    [3, 1],
  ]);
  expect(rows.map((row) => row.id)).toEqual([3, 2, 1]);
});
