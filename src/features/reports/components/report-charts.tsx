import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { TruncatedText } from "@/components/truncated-text";
import type { ReportResponse } from "../schemas/reports-schema";

import { ReportRateChart } from "./report-rate-chart";
import {
  reportChartColor,
  reportNumberFormat as numberFormat,
} from "../utils/report-chart";

function ShareChart({
  data,
}: Readonly<{ data: ReportResponse["dict_bieudo_02"] }>) {
  const entries = Object.entries(data);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let cursor = 0;
  const segments = entries.map(([, value], index) => {
    const start = cursor;
    cursor += total > 0 ? (value / total) * 100 : 0;
    return `${reportChartColor(index)} ${start}% ${cursor}%`;
  });
  return (
    <Card className="min-w-0 gap-4 p-4 sm:p-5">
      <h2 className="text-base font-semibold">Tỷ lệ đảm nhận</h2>
      {total > 0 ? (
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-5 sm:flex-row">
          <div
            role="img"
            aria-label={`Tỷ lệ đảm nhận: ${numberFormat.format(total)} yêu cầu`}
            className="relative flex size-44 shrink-0 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(${segments.join(",")})` }}
          >
            <div className="flex size-30 flex-col items-center justify-center rounded-full bg-card">
              <strong className="text-2xl tabular-nums">
                {numberFormat.format(total)}
              </strong>
              <span className="text-xs text-muted-foreground">yêu cầu</span>
            </div>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-2">
            {entries.map(([label, value], index) => (
              <li
                key={label}
                className="flex min-w-0 items-center gap-2 text-xs"
                title={`${label}: ${value} (${numberFormat.format((value / total) * 100)}%)`}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: reportChartColor(index) }}
                  aria-hidden="true"
                />
                <TruncatedText text={label} className="flex-1" />
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {numberFormat.format(value)}
                </span>
                <span className="w-12 shrink-0 text-right font-medium tabular-nums">
                  {numberFormat.format((value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          title="Chưa có dữ liệu đảm nhận"
          className="min-h-48 border-0 shadow-none"
        />
      )}
    </Card>
  );
}

export function ReportCharts({ report }: Readonly<{ report: ReportResponse }>) {
  return (
    <div className="space-y-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ShareChart data={report.dict_bieudo_02} />
        <ReportRateChart
          title="Tỷ lệ yêu cầu đúng thời hạn"
          data={report.dict_bieudo_03}
        />
      </div>
      <ReportRateChart
        title="Tỷ lệ loại yêu cầu"
        data={report.dict_bieudo_04}
        line
      />
    </div>
  );
}
