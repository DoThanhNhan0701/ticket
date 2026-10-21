import type { RecruitmentRow } from "../types";
import { recruitmentText } from "./recruitment-format";
export function interviewMinutes(value: unknown): number {
  const match = /^(\d{2}):(\d{2})/.exec(recruitmentText(value));
  return match ? Math.min(1440, Number(match[1]) * 60 + Number(match[2])) : 0;
}
export function layoutInterviews(rows: RecruitmentRow[]) {
  const sorted = [...rows].sort(
    (a, b) => interviewMinutes(a.time_start) - interviewMinutes(b.time_start),
  );
  const groups: RecruitmentRow[][] = [];
  let groupEnd = -1;
  for (const row of sorted) {
    const start = interviewMinutes(row.time_start);
    if (start >= groupEnd) groups.push([]);
    groups[groups.length - 1].push(row);
    groupEnd = Math.max(groupEnd, start + 5, interviewMinutes(row.time_end));
  }
  return groups.flatMap(layoutGroup);
}
function layoutGroup(rows: RecruitmentRow[]) {
  const laneEnds: number[] = [];
  const events = rows.map((row) => {
    const start = interviewMinutes(row.time_start),
      end = interviewMinutes(row.time_end);
    let lane = laneEnds.findIndex((value) => value <= start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = Math.max(start + 5, end);
    return { row, start, end, lane };
  });
  return events.map((event) => ({
    ...event,
    lanes: Math.max(1, laneEnds.length),
  }));
}
