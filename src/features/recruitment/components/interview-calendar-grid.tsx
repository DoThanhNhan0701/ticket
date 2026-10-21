import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Clock3, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RecruitmentAction, RecruitmentRow } from "../types";
import { recruitmentText as text } from "../utils/recruitment-format";
import { layoutInterviews } from "../utils/interview-layout";
const slotHeight = 64;

interface GridProps {
  days: Date[];
  rows: RecruitmentRow[];
  view: "month" | "week" | "day";
  disabled: boolean;
  canViewCV: boolean;
  onCreate: (date: string, time?: string) => void;
  onAction: (action: RecruitmentAction, row: RecruitmentRow) => void;
  onViewCV: (id: number) => void;
}
function InterviewCard({
  row,
  props,
  compact = false,
}: Readonly<{ row: RecruitmentRow; props: GridProps; compact?: boolean }>) {
  const id = Number(row.id_interview ?? row.id);
  const record = { ...row, id };
  const title = text(row.title);
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
      <p
        className={cn(
          "flex shrink-0 items-center gap-1 whitespace-nowrap leading-4 text-brand-700 tabular-nums dark:text-brand-200",
          compact && "leading-3",
        )}
      >
        {!compact && <Clock3 aria-hidden="true" className="size-3 shrink-0" />}
        {text(row.time_start).slice(0, 5)} – {text(row.time_end).slice(0, 5)}
      </p>
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
          aria-label={`Sửa lịch ${title}`}
          title="Chi tiết / sửa lịch"
          disabled={props.disabled}
          onClick={() => props.onAction("interview", record)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:bg-danger-soft hover:text-destructive dark:hover:bg-danger-soft"
          aria-label={`Xóa lịch ${title}`}
          title="Xóa lịch"
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
            aria-label={`Xem CV lịch ${title}`}
            title="Xem CV phỏng vấn"
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
  const scroll = useRef<HTMLDivElement>(null);
  const reset = `${props.view}-${format(props.days[0], "yyyy-MM-dd")}`;
  useEffect(() => {
    if (scroll.current && props.view !== "month")
      scroll.current.scrollTop = 8 * 2 * slotHeight;
  }, [reset, props.view]);
  const today = format(new Date(), "yyyy-MM-dd");
  if (props.view === "month")
    return (
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card">
        <div
          role="grid"
          aria-label="Lịch phỏng vấn"
          className="grid min-w-[980px] grid-cols-7"
        >
          {props.days.map((day) => {
            const date = format(day, "yyyy-MM-dd");
            return (
              <div
                role="gridcell"
                key={date}
                className="min-h-32 space-y-2 border-r border-b p-2"
              >
                <Button
                  variant={date === today ? "default" : "ghost"}
                  className="h-8 px-2 text-xs"
                  disabled={props.disabled || date < today}
                  aria-label={`Tạo lịch ngày ${format(day, "dd/MM/yyyy")}`}
                  onClick={() => props.onCreate(date)}
                >
                  {format(day, "EEE dd/MM", { locale: vi })}
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
      </div>
    );
  const columns = `3.5rem repeat(${props.days.length}, minmax(7rem, 1fr))`;
  return (
    <div
      ref={scroll}
      className="relative min-h-80 flex-1 overflow-auto rounded-xl border bg-card"
    >
      <div
        role="grid"
        aria-label="Lịch phỏng vấn"
        className={props.view === "week" ? "min-w-[980px]" : "min-w-0"}
      >
        <div
          className="sticky top-0 z-20 grid border-b bg-card"
          style={{ gridTemplateColumns: columns }}
        >
          <div className="border-r p-2 text-xs text-muted-foreground">Giờ</div>
          {props.days.map((day) => (
            <div
              key={String(day)}
              className={`border-r p-2 text-center text-xs font-semibold ${format(day, "yyyy-MM-dd") === today ? "text-primary" : ""}`}
            >
              {format(day, "EEE dd/MM", { locale: vi })}
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: columns }}>
          <div className="border-r">
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
              <div role="gridcell" key={date} className="relative border-r">
                {Array.from({ length: 48 }, (_, slot) => {
                  const time = `${String(Math.floor(slot / 2)).padStart(2, "0")}:${slot % 2 ? "30" : "00"}`;
                  return (
                    <button
                      key={time}
                      type="button"
                      className="block w-full border-b border-dashed border-border/60 hover:bg-primary/5 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none"
                      style={{ height: slotHeight }}
                      aria-label={`Tạo lịch ${format(day, "dd/MM/yyyy")} ${time}`}
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
