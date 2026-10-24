import { t, useLocale } from "@/i18n";
import type { RecruitmentRow } from "../types";
import { recruitmentText } from "../utils/recruitment-format";
import "./recruitment-report.css";

function chartValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function RecruitmentChart({
  rows,
  section,
}: Readonly<{ rows: RecruitmentRow[]; section?: string }>) {
  const locale = useLocale();
  const numberFormat = new Intl.NumberFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    { maximumFractionDigits: 1 },
  );
  const isDuration = section === "result_time_recruitment";
  const metric = isDuration
    ? "rate_pass"
    : ([
        "number_cv_all",
        "number_cv",
        "number_cv_pass",
        "quantity",
        "value",
        "count",
        "rate",
      ].find((key) => rows.some((row) => row[key] !== undefined)) ??
      "number_cv");
  const metricTitles: Record<string, string> = {
    number_cv_pass: t("recruitment-reports", "Số CV đã nhận việc"),
    quantity: t("recruitment-reports", "Số lượng yêu cầu"),
    value: t("recruitment-reports", "Số lượng"),
    count: t("recruitment-reports", "Số lượng"),
    rate: t("recruitment-reports", "Tỷ lệ (%)"),
  };
  const title = isDuration
    ? t("recruitment-reports", "Thời gian tuyển dụng (ngày)")
    : (metricTitles[metric] ?? t("recruitment-reports", "Số lượng CV"));
  const maximum = Math.max(1, ...rows.map((row) => chartValue(row[metric])));
  return (
    <figure
      aria-label={
        isDuration
          ? t("recruitment-reports", "Biểu đồ thời gian tuyển dụng")
          : t("recruitment-reports", "Biểu đồ số lượng CV")
      }
      className="min-w-0 shrink-0 space-y-4 rounded-xl border bg-linear-to-br from-primary/5 via-card to-card p-3 sm:p-5"
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          {title}
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          {numberFormat.format(rows.length)}{" "}
          {t("recruitment-reports", "nhóm dữ liệu")}{" "}
        </span>
      </figcaption>
      <div
        className="max-h-64 space-y-1 overflow-y-auto overscroll-contain pr-3 [scrollbar-gutter:stable] sm:max-h-72"
        role="region"
        aria-label={title}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll the chart categories.
        tabIndex={0}
      >
        {rows.map((row, index) => {
          let label = recruitmentText(
            row.rec_position ||
              row.department_recruited_name ||
              row.department_recruited ||
              row.username ||
              row.candidate_source__name ||
              row.name ||
              row.month,
          );
          if (section === "result_department_month" && row.month)
            label = `${label} · ${recruitmentText(row.month)}`;
          if (section === "result_cv_status")
            label = t(
              "statuses",
              recruitmentText(
                row.cv_status__name || row.cv_status_name || row.name,
              ),
            );
          const value = chartValue(row[metric]);
          return (
            <div
              key={`${label}-${index}`}
              className="group grid min-w-0 grid-cols-[minmax(0,1fr)_4rem] items-center gap-x-3 gap-y-2 rounded-lg px-2 py-2.5 text-xs transition-colors hover:bg-primary/5 sm:grid-cols-[minmax(8rem,1fr)_minmax(0,3fr)_4rem] motion-reduce:transition-none"
            >
              <span className="truncate" title={label}>
                {label}
              </span>
              <div
                className="col-span-2 row-start-2 h-2.5 overflow-hidden rounded-full bg-muted sm:col-span-1 sm:col-start-2 sm:row-start-1"
                aria-hidden="true"
              >
                <div
                  className="recruitment-chart-bar h-full origin-left rounded-full bg-linear-to-r from-primary to-brand-cyan"
                  style={{
                    width: `${(value / maximum) * 100}%`,
                    animationDelay: `${Math.min(index, 10) * 35}ms`,
                  }}
                />
              </div>
              <span className="col-start-2 row-start-1 text-right font-semibold tabular-nums sm:col-start-3">
                {numberFormat.format(value)}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
