import { useId } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { TruncatedText } from "@/components/truncated-text";
import { useElementWidth } from "@/hooks/use-element-width";
import type { ReportResponse } from "../schemas/reports-schema";
import {
  reportChartColor,
  reportNumberFormat as numberFormat,
  reportRateDescription,
} from "../utils/report-chart";

type RateEntry = [string, [number, number, number]];

function RateValues({
  values,
}: Readonly<{ values: readonly [number, number, number] }>) {
  const [rate, count, total] = values;
  return (
    <span className="shrink-0 whitespace-nowrap text-xs tabular-nums">
      <span className="text-[11px] text-muted-foreground">
        {numberFormat.format(count)}/{numberFormat.format(total)}
      </span>
      <span className="ml-2 font-semibold">{numberFormat.format(rate)}%</span>
    </span>
  );
}
function RateTrack({ rate }: Readonly<{ rate: number }>) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-muted"
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${rate}%` }}
      />
    </div>
  );
}
function CompactRates({
  entries,
  line,
}: Readonly<{ entries: readonly RateEntry[]; line: boolean }>) {
  return (
    <ul className={line ? "space-y-3" : "space-y-2"}>
      {entries.map(([label, values]) =>
        line ? (
          <li
            key={label}
            title={reportRateDescription(label, values)}
            className="min-w-0 space-y-1.5"
          >
            <div className="flex min-w-0 items-baseline justify-between gap-3 text-xs">
              <TruncatedText text={label} className="flex-1 font-medium" />
              <RateValues values={values} />
            </div>
            <RateTrack rate={values[0]} />
          </li>
        ) : (
          <li
            key={label}
            title={reportRateDescription(label, values)}
            className="grid min-h-6 min-w-0 grid-cols-[minmax(0,1fr)_minmax(2rem,1fr)_auto] items-center gap-3 text-xs"
          >
            <TruncatedText text={label} className="font-medium" />
            <RateTrack rate={values[0]} />
            <RateValues values={values} />
          </li>
        ),
      )}
    </ul>
  );
}

function RatePlot({
  entries,
  width,
  line,
}: Readonly<{ entries: readonly RateEntry[]; width: number; line: boolean }>) {
  const left = 42;
  const right = 18;
  const plotWidth = width - left - right;
  const points = entries.map(([label, [rate, count, total]], index) => ({
    label,
    rate,
    count,
    total,
    x: left + ((index + 0.5) * plotWidth) / entries.length,
    y: 224 - rate * 1.92,
  }));
  return (
    <div className="flex min-h-72 flex-1 flex-col justify-center gap-3">
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${width} 240`}
        className="block h-60 w-full overflow-visible"
      >
        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value} className="text-muted-foreground">
            <line
              x1={left}
              x2={width - right}
              y1={224 - value * 1.92}
              y2={224 - value * 1.92}
              stroke="currentColor"
              strokeOpacity="0.16"
            />
            <text
              x={left - 8}
              y={228 - value * 1.92}
              textAnchor="end"
              fill="currentColor"
              fontSize="10"
            >
              {value}%
            </text>
          </g>
        ))}
        {line && (
          <polyline
            points={points.map(({ x, y }) => `${x},${y}`).join(" ")}
            fill="none"
            stroke={reportChartColor(0)}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        )}
        {points.map((point) => (
          <g key={point.label}>
            <title>
              {reportRateDescription(point.label, [
                point.rate,
                point.count,
                point.total,
              ])}
            </title>
            {line ? (
              <circle
                cx={point.x}
                cy={point.y}
                r="4.5"
                fill={reportChartColor(0)}
                stroke="var(--card)"
                strokeWidth="2"
              />
            ) : (
              <rect
                x={point.x - Math.min(20, (plotWidth / entries.length) * 0.25)}
                y={point.y}
                width={Math.min(40, (plotWidth / entries.length) * 0.5)}
                height={224 - point.y}
                rx="4"
                fill={reportChartColor(0)}
              />
            )}
            <text
              x={point.x}
              y={point.y - 10}
              textAnchor="middle"
              fill="currentColor"
              fontSize="11"
              className="tabular-nums"
            >
              {numberFormat.format(point.rate)}%
            </text>
          </g>
        ))}
      </svg>
      <div
        className="grid items-start gap-2"
        style={{
          marginLeft: left,
          marginRight: right,
          gridTemplateColumns: `repeat(${entries.length}, minmax(0, 1fr))`,
        }}
      >
        {entries.map(([label, values]) => (
          <div
            key={label}
            title={reportRateDescription(label, values)}
            className="min-w-0 space-y-1 text-center text-xs"
          >
            <TruncatedText text={label} className="font-medium" />
            <span className="block text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
              {numberFormat.format(values[1])}/{numberFormat.format(values[2])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResponsiveRates({
  title,
  entries,
  line,
}: Readonly<{ title: string; entries: readonly RateEntry[]; line: boolean }>) {
  const { ref, width } = useElementWidth();
  const descriptionId = useId();
  const compact = width < Math.max(360, entries.length * 56 + 60);
  return (
    <div
      ref={ref}
      role="region"
      aria-label={title}
      className="flex min-w-0 flex-1 flex-col justify-center"
    >
      <p id={descriptionId} className="sr-only">
        {entries
          .map(([label, values]) => reportRateDescription(label, values))
          .join("; ")}
      </p>
      <div
        role="img"
        aria-label={title}
        aria-describedby={descriptionId}
        className="flex min-w-0 flex-1 flex-col justify-center"
      >
        {compact ? (
          <CompactRates entries={entries} line={line} />
        ) : (
          <RatePlot entries={entries} width={width} line={line} />
        )}
      </div>
    </div>
  );
}

export function ReportRateChart({
  title,
  data,
  line = false,
}: Readonly<{
  title: string;
  data: ReportResponse["dict_bieudo_03"];
  line?: boolean;
}>) {
  const entries = Object.entries(data);
  return (
    <Card className="min-w-0 gap-4 p-4 sm:p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {entries.length ? (
        <ResponsiveRates title={title} entries={entries} line={line} />
      ) : (
        <EmptyState
          title="Chưa có dữ liệu tỷ lệ"
          className="min-h-48 border-0 shadow-none"
        />
      )}
    </Card>
  );
}
