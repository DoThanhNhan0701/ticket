import type { RecruitmentRow } from "../types";
import { recruitmentText } from "../utils/recruitment-format";
export function RecruitmentChart({
  rows,
}: Readonly<{ rows: RecruitmentRow[] }>) {
  const metric =
    ["number_cv_all", "number_cv", "number_cv_pass"].find((key) =>
      rows.some((row) => row[key] !== undefined),
    ) ?? "number_cv";
  const maximum = Math.max(
    1,
    ...rows.map((row) => Math.max(0, Number(row[metric]) || 0)),
  );
  return (
    <figure
      aria-label="Biểu đồ số lượng CV"
      className="space-y-3 rounded-xl border bg-muted/20 p-4"
    >
      <figcaption className="text-sm font-semibold">
        {metric === "number_cv_pass" ? "Số CV đã nhận việc" : "Số lượng CV"}
      </figcaption>
      <div className="max-h-72 space-y-3 overflow-y-auto">
        {rows.map((row, index) => {
          const label = recruitmentText(
            row.rec_position ||
              row.department_recruited ||
              row.username ||
              row.candidate_source__name ||
              row.name ||
              row.month,
          );
          const value = Math.max(0, Number(row[metric]) || 0);
          return (
            <div
              key={`${label}-${index}`}
              className="grid grid-cols-[minmax(5rem,1fr)_3fr_auto] items-center gap-3 text-xs"
            >
              <span className="truncate" title={label}>
                {label}
              </span>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(value / maximum) * 100}%` }}
                />
              </div>
              <span className="tabular-nums">{value}</span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
