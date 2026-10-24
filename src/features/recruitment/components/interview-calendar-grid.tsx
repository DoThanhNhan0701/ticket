import { t, useLocale, getLocale } from "@/i18n";
import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { vi, enGB } from "date-fns/locale";
import { Clock3, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  RecruitmentAction,
  RecruitmentRow,
  RecruitmentOption,
} from "../types";
import {
  recruitmentText as text,
  recruitmentRows,
} from "../utils/recruitment-format";
import { layoutInterviews } from "../utils/interview-layout";
const slotHeight = 64;

interface GridProps {
  days: Date[];
  rows: RecruitmentRow[];
  view: "month" | "week" | "day";
  disabled: boolean;
  canViewCV: boolean;
  interviewers?: readonly RecruitmentOption[];
  onCreate: (date: string, time?: string) => void;
  onAction: (action: RecruitmentAction, row: RecruitmentRow) => void;
  onViewCV: (id: number) => void;
}
function interviewerNames(
  row: RecruitmentRow,
  options: readonly RecruitmentOption[] = [],
) {
  const detailed = recruitmentRows(row.data_user_interview)
    .map(
      (user) =>
        text(user.full_name).trim() ||
        text(user.name).trim() ||
        [text(user.last_name).trim(), text(user.first_name).trim()]
          .filter(Boolean)
          .join(" ") ||
        text(user.username).trim(),
    )
    .filter(Boolean);
  if (detailed.length) return detailed;
  const legacy = text(row.user_interview_name).trim();
  if (legacy)
    return legacy
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
  const assigned = Array.isArray(row.user_interview)
    ? row.user_interview.map(text)
    : text(row.user_interview).split(",");
  const labels = new Map(options.map((option) => [option.value, option.label]));
  const ids = [...new Set(assigned.map((id) => id.trim()).filter(Boolean))];
  return ids.map((id) => labels.get(id)?.trim() ?? "").filter(Boolean);
}
function InterviewCard({
  row,
  props,
  compact = false,
}: Readonly<{ row: RecruitmentRow; props: GridProps; compact?: boolean }>) {
  useLocale();
  const id = Number(row.id_interview ?? row.id);
  const record = { ...row, id };
  const title = text(row.title);
  const interviewers = interviewerNames(row, props.interviewers);
  return (
    <article
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col gap-1.5 overflow-auto rounded-lg border border-l-[3px] border-brand-200 border-l-primary bg-brand-50/80 p-2 text-xs text-foreground shadow-xs dark:border-brand-800 dark:border-l-brand-400 dark:bg-brand-950/70",
        props.view !== "month" && "h-full",
        compact && "gap-0.5 px-1 py-0.5",
      )}
    >
      <p
        className={cn(
          "shrink-0 leading-4 font-semibold",
          compact ? "truncate leading-3.5" : "line-clamp-2 break-words",
        )}
        title={[title, text(row.user_create_name)].filter(Boolean).join(" · ")}
      >
        {title}
      </p>
      <div
        className={cn(
          "min-w-0",
          compact ? "flex items-center gap-1" : "space-y-1",
        )}
      >
        <p
          className={cn(
            "flex shrink-0 items-center gap-1 whitespace-nowrap leading-4 text-brand-700 tabular-nums dark:text-brand-200",
            compact && "leading-3",
          )}
        >
          {!compact && (
            <Clock3 aria-hidden="true" className="size-3 shrink-0" />
          )}
          {text(row.time_start).slice(0, 5)} – {text(row.time_end).slice(0, 5)}
        </p>
        {interviewers.length > 0 && (
          <Tooltip>
            <TooltipTrigger
              type="button"
              aria-label={t("interviews", "Người phỏng vấn: {0}", [
                interviewers.join(", "),
              ])}
              className={cn(
                "flex min-w-0 max-w-full items-center gap-1 rounded-sm text-left text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
                compact ? "leading-3" : "leading-4",
              )}
            >
              <span className="truncate">{interviewers[0]}</span>
              {interviewers.length > 1 && (
                <span className="shrink-0 font-medium">
                  +{interviewers.length - 1}
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent
              role="tooltip"
              className="block whitespace-normal wrap-anywhere"
            >
              <p className="mb-1 font-medium">
                {t("interviews", "Người phỏng vấn")}
              </p>
              <ul>
                {interviewers.map((name, index) => (
                  <li key={`${index}:${name}`}>{name}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div
        className={cn(
          "mt-auto flex shrink-0 flex-wrap items-center gap-0.5 border-t border-brand-200/70 pt-1 dark:border-brand-800",
          compact && "border-t-0 pt-0",
        )}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-900"
          aria-label={t("interviews", "Sửa lịch {0}", [title])}
          title={t("interviews", "Chi tiết / sửa lịch")}
          disabled={props.disabled}
          onClick={() => props.onAction("interview", record)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:bg-danger-soft hover:text-destructive dark:hover:bg-danger-soft"
          aria-label={t("interviews", "Xóa lịch {0}", [title])}
          title={t("interviews", "Xóa lịch")}
          disabled={props.disabled}
          onClick={() => props.onAction("delete-interview", record)}
        >
          <Trash2 className="size-3.5" />
        </Button>
        {props.canViewCV && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-900"
            aria-label={t("interviews", "Xem CV lịch {0}", [title])}
            title={t("interviews", "Xem CV phỏng vấn")}
            disabled={props.disabled}
            onClick={() => props.onViewCV(id)}
          >
            <Users className="size-3.5" />
          </Button>
        )}
      </div>
    </article>
  );
}
export function InterviewCalendarGrid(props: Readonly<GridProps>) {
  useLocale();
  const scroll = useRef<HTMLDivElement>(null);
  const reset = `${props.view}-${format(props.days[0], "yyyy-MM-dd")}`;
  useEffect(() => {
    if (scroll.current && props.view !== "month")
      scroll.current.scrollTop = 8 * 2 * slotHeight;
  }, [reset, props.view]);
  const today = format(new Date(), "yyyy-MM-dd");
  if (props.view === "month")
    return (
      <div
        role="region"
        aria-label={t("interviews", "Cuộn lịch phỏng vấn")}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll the calendar.
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div
          role="grid"
          aria-label={t("interviews", "Lịch phỏng vấn")}
          className="min-w-[980px]"
        >
          {Array.from(
            { length: Math.ceil(props.days.length / 7) },
            (_, week) => (
              <div role="row" key={week} className="grid grid-cols-7">
                {props.days.slice(week * 7, week * 7 + 7).map((day) => {
                  const date = format(day, "yyyy-MM-dd");
                  return (
                    <div
                      role="gridcell"
                      aria-label={format(day, "dd/MM/yyyy")}
                      key={date}
                      className="min-h-32 space-y-2 border-r border-b p-2"
                    >
                      <Button
                        variant={date === today ? "default" : "ghost"}
                        className="h-8 px-2 text-xs"
                        disabled={props.disabled || date < today}
                        aria-label={t("interviews", "Tạo lịch ngày {0}", [
                          format(day, "dd/MM/yyyy"),
                        ])}
                        onClick={() => props.onCreate(date)}
                      >
                        {format(day, "EEE dd/MM", {
                          locale: getLocale() === "vi" ? vi : enGB,
                        })}
                      </Button>
                      {props.rows
                        .filter((row) => row.start_date === date)
                        .sort((a, b) =>
                          text(a.time_start).localeCompare(text(b.time_start)),
                        )
                        .map((row) => (
                          <InterviewCard
                            key={String(row.id_interview ?? row.id)}
                            row={row}
                            props={props}
                          />
                        ))}
                    </div>
                  );
                })}
              </div>
            ),
          )}
        </div>
      </div>
    );
  const columns = `3.5rem repeat(${props.days.length}, minmax(7rem, 1fr))`;
  return (
    <div
      ref={scroll}
      role="region"
      aria-label={t("interviews", "Cuộn lịch phỏng vấn")}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll the calendar.
      tabIndex={0}
      className="relative min-h-80 flex-1 overflow-auto rounded-xl border bg-card focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div
        role="grid"
        aria-label={t("interviews", "Lịch phỏng vấn")}
        className={props.view === "week" ? "min-w-[980px]" : "min-w-0"}
      >
        <div
          role="row"
          className="sticky top-0 z-20 grid border-b bg-card"
          style={{ gridTemplateColumns: columns }}
        >
          <div
            role="columnheader"
            className="border-r p-2 text-xs text-muted-foreground"
          >
            {t("interviews", "Giờ")}
          </div>
          {props.days.map((day) => (
            <div
              role="columnheader"
              key={String(day)}
              className={`border-r p-2 text-center text-xs font-semibold ${format(day, "yyyy-MM-dd") === today ? "text-primary" : ""}`}
            >
              {format(day, "EEE dd/MM", {
                locale: getLocale() === "vi" ? vi : enGB,
              })}
            </div>
          ))}
        </div>
        <div
          role="row"
          className="grid"
          style={{ gridTemplateColumns: columns }}
        >
          <div
            role="rowheader"
            aria-label={t("interviews", "Giờ trong ngày")}
            className="border-r"
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className="border-b pt-1 text-center text-xs text-muted-foreground tabular-nums"
                style={{ height: slotHeight * 2 }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {props.days.map((day) => {
            const date = format(day, "yyyy-MM-dd");
            return (
              <div
                role="gridcell"
                aria-label={format(day, "dd/MM/yyyy")}
                key={date}
                className="relative border-r"
              >
                {Array.from({ length: 48 }, (_, slot) => {
                  const time = `${String(Math.floor(slot / 2)).padStart(2, "0")}:${slot % 2 ? "30" : "00"}`;
                  return (
                    <button
                      key={time}
                      type="button"
                      className="block w-full border-b border-dashed border-border/60 hover:bg-primary/5 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none"
                      style={{ height: slotHeight }}
                      aria-label={t("interviews", "Tạo lịch {0} {1}", [
                        format(day, "dd/MM/yyyy"),
                        time,
                      ])}
                      disabled={
                        props.disabled ||
                        new Date(`${date}T${time}`) <= new Date()
                      }
                      onClick={() => props.onCreate(date, time)}
                    />
                  );
                })}
                {layoutInterviews(
                  props.rows.filter((row) => row.start_date === date),
                ).map((event) => (
                  <div
                    key={String(event.row.id_interview ?? event.row.id)}
                    className="absolute z-10 px-0.5 pb-0.5"
                    style={{
                      top: (event.start / 30) * slotHeight,
                      height: Math.max(
                        slotHeight,
                        ((event.end - event.start) / 30) * slotHeight,
                      ),
                      left: `${(event.lane / event.lanes) * 100}%`,
                      width: `${100 / event.lanes}%`,
                    }}
                  >
                    <InterviewCard
                      row={event.row}
                      props={props}
                      compact={event.end - event.start <= 30}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
