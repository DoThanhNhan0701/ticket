import { useId, type ReactNode } from "react";
import {
  Building2,
  CalendarCheck,
  CalendarPlus,
  ChevronDown,
  FileText,
  FileType,
  MapPin,
  MessageSquare,
  Network,
  NotebookPen,
  Paperclip,
  UserCheck,
  UserPlus,
  UserRound,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { formatDataDate } from "@/components/data-management";
import { cn } from "@/lib/utils";
import type { RequestDetailData } from "../schemas/request-detail-schema";
import { ticketFileUrl } from "../utils/ticket-detail";
import { TicketAttachments } from "./ticket-attachments";
import { TicketDueDate } from "./ticket-due-date";

function GeneralSection({
  title,
  description,
  icon: Icon,
  badge,
  children,
  className,
}: Readonly<{
  title: string;
  description?: string;
  icon: LucideIcon;
  badge?: number;
  children: ReactNode;
  className?: string;
}>) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <Icon className="size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id={id} className="flex items-center gap-2 text-sm font-semibold">
            {title}
            {badge !== undefined && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary tabular-nums">
                {badge}
              </span>
            )}
          </h2>
          {description && (
            <p
              title={description}
              className="mt-0.5 truncate text-xs text-muted-foreground"
            >
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function ReadField({
  label,
  value,
  icon: Icon,
}: Readonly<{ label: string; value: ReactNode; icon: LucideIcon }>) {
  return (
    <div className="min-w-0 space-y-1.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
      </dt>
      <dd
        aria-label={label}
        className="min-h-5 text-sm font-medium whitespace-pre-wrap wrap-anywhere"
      >
        {value}
      </dd>
    </div>
  );
}

export function TicketGeneral({
  ticket,
  onSaved,
}: Readonly<{ ticket: RequestDetailData; onSaved: () => Promise<unknown> }>) {
  const manual = ticketFileUrl(ticket.ticket_type_att_file);
  const reasons = [
    ["Lý do hủy", ticket.lydohuyyeucau],
    ["Lý do xử lý lại", ticket.lydoxulylai],
    ["Lý do không xử lý lại", ticket.lydokhongxulylai],
    ["Lý do thay đổi người xử lý", ticket.lydothaydoinguoixuly],
  ].filter(([, value]) => value);
  return (
    <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] xl:grid-rows-[1fr_auto]">
      <GeneralSection
        title="Thông tin yêu cầu"
        className="xl:col-start-1 xl:row-start-1"
        description="Thông tin cơ bản và đơn vị sử dụng"
        icon={FileText}
      >
        <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 sm:[&>div:nth-child(even)]:border-l sm:[&>div:nth-child(even)]:border-border sm:[&>div:nth-child(even)]:pl-6">
          <ReadField
            label="Bộ phận xử lý"
            icon={Wrench}
            value={ticket.handling_group_name}
          />
          <ReadField
            label="Loại yêu cầu"
            icon={FileType}
            value={ticket.ticket_type_name}
          />
          <ReadField
            label="Bộ phận sử dụng"
            icon={Network}
            value={ticket.bophansudung_name}
          />
          <ReadField
            label="Team sử dụng"
            icon={UsersRound}
            value={ticket.list_name_team_use
              .map((team) => team.name)
              .join(", ")}
          />
          <ReadField
            label="Văn phòng"
            icon={MapPin}
            value={ticket.vanphong_name}
          />
          <ReadField
            label="Công ty"
            icon={Building2}
            value={ticket.customer_name}
          />
        </dl>
        {manual && (
          <a
            href={manual}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex text-sm text-primary underline-offset-4 hover:underline"
          >
            Tài liệu hướng dẫn
          </a>
        )}
        <dl className="mt-5 space-y-4 border-t border-border pt-4">
          <ReadField
            label="Ghi chú"
            icon={NotebookPen}
            value={ticket.description}
          />
          {reasons.map(([label, value]) => (
            <ReadField
              key={label}
              label={label}
              icon={MessageSquare}
              value={value}
            />
          ))}
        </dl>
      </GeneralSection>
      <GeneralSection
        title="Thông tin xử lý"
        className="xl:col-start-2 xl:row-span-2 xl:row-start-1"
        description="Người phụ trách, thời gian và trạng thái xử lý yêu cầu."
        icon={UserRound}
      >
        <dl className="space-y-4 [&>div+div]:border-t [&>div+div]:border-border [&>div+div]:pt-4">
          <ReadField
            label="Người phê duyệt"
            icon={UserCheck}
            value={ticket.approve_user_name}
          />
          <ReadField
            label="Người xử lý"
            icon={UsersRound}
            value={
              ticket.list_user_received.length > 0 ? (
                <details className="group/handlers">
                  <summary className="flex min-h-5 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    <span>{ticket.list_user_received.length} người xử lý</span>
                    <ChevronDown
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground group-open/handlers:rotate-180"
                    />
                  </summary>
                  <ul aria-label="Tình trạng xử lý" className="space-y-3 pt-3">
                    {ticket.list_user_received.map((user, index) => (
                      <li
                        key={user.user_id ?? index}
                        className="flex min-w-0 items-center gap-2.5"
                      >
                        <span
                          aria-hidden="true"
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                        >
                          {user.username
                            .trim()
                            .split(/\s+/)
                            .map((part) => part[0])
                            .slice(-2)
                            .join("")
                            .toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="wrap-anywhere">{user.username}</p>
                          {user.status && (
                            <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                              {user.status}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                ""
              )
            }
          />
          <ReadField
            label="Người tạo"
            icon={UserPlus}
            value={ticket.username_create}
          />
          <ReadField
            label="Ngày tạo"
            icon={CalendarPlus}
            value={formatDataDate(ticket.created)}
          />
          <div>
            <dt className="sr-only">Ngày mong muốn</dt>
            <dd>
              <TicketDueDate ticket={ticket} onSaved={onSaved} />
            </dd>
          </div>
          <ReadField
            label="Ngày phê duyệt"
            icon={CalendarCheck}
            value={formatDataDate(
              ticket.ticket_ngaypheduyet || ticket.approve_date,
            )}
          />
        </dl>
      </GeneralSection>
      <GeneralSection
        title="Tệp đính kèm"
        className="xl:col-start-1 xl:row-start-2"
        icon={Paperclip}
        badge={Object.keys(ticket.attachment_files).length}
      >
        <TicketAttachments ticket={ticket} onSaved={onSaved} />
      </GeneralSection>
    </div>
  );
}
