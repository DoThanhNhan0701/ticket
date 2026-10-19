import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { TruncatedText } from "@/components/truncated-text";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RequestTicket } from "../types";

const columns: { label: string; width: string; center?: boolean }[] = [
  { label: "Mã yêu cầu", width: "15%" },
  { label: "Loại yêu cầu", width: "14%" },
  { label: "Tiêu đề", width: "20%" },
  { label: "Department", width: "8%", center: true },
  { label: "Team", width: "4%", center: true },
  { label: "Văn phòng", width: "9%" },
  { label: "Ngày mong muốn", width: "8%", center: true },
  { label: "Người phê duyệt", width: "7%", center: true },
  { label: "Trạng thái", width: "8%", center: true },
  { label: "Cập nhật bởi", width: "7%", center: true },
];

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});
function formatDueDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

function RequestCell({
  text,
  className,
}: Readonly<{ text?: string; className?: string }>) {
  return (
    <TableCell className={className}>
      <TruncatedText text={text || "—"} lines={2} />
    </TableCell>
  );
}

export function RequestTable({ rows }: Readonly<{ rows: RequestTicket[] }>) {
  const navigate = useNavigate();
  return (
    <Table
      aria-label="Danh sách yêu cầu"
      className="min-w-[88rem] table-fixed [&_td]:px-3 [&_td]:py-3 [&_td]:align-middle"
      wrapperClassName="min-h-0 flex-1 overscroll-contain rounded-t-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      scrollRegionLabel="Cuộn bảng yêu cầu"
    >
      <colgroup>
        {columns.map((column) => (
          <col key={column.label} style={{ width: column.width }} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.label}
              scope="col"
              className={cn(
                "px-3 py-3 align-middle whitespace-normal",
                column.center && "text-center",
              )}
            >
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((request) => {
          const path = `/tickets/${encodeURIComponent(String(request.id))}`;
          const color =
            request.color && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(request.color)
              ? request.color
              : undefined;
          return (
            <TableRow
              key={request.id}
              className="h-18 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              tabIndex={0}
              onClick={(event) => {
                if (
                  event.defaultPrevented ||
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  (event.target instanceof Element && event.target.closest("a"))
                )
                  return;
                navigate(path);
              }}
              onKeyDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  event.key === "Enter"
                ) {
                  event.preventDefault();
                  navigate(path);
                }
              }}
            >
              <TableCell className="font-medium">
                <Link
                  to={path}
                  className="rounded text-brand-700 focus-visible:outline-2 focus-visible:outline-ring dark:text-brand-200"
                >
                  <TruncatedText
                    text={request.ticket_code || String(request.id)}
                    lines={2}
                  />
                </Link>
              </TableCell>
              <RequestCell text={request.ticket_type_name} />
              <TableCell>
                <Link
                  to={path}
                  className="rounded font-medium focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <TruncatedText text={request.title || "—"} lines={2} />
                </Link>
              </TableCell>
              <RequestCell
                text={request.bophansudung_name}
                className="text-center"
              />
              <RequestCell
                text={request.list_name_team_use
                  .map((team) => team.name)
                  .join(", ")}
                className="text-center"
              />
              <RequestCell text={request.vanphong_name} />
              <RequestCell
                text={formatDueDate(request.duedate)}
                className="text-center tabular-nums"
              />
              <RequestCell
                text={request.approve_user_name}
                className="text-center"
              />
              <TableCell className="text-center">
                {request.ticket_status_name ? (
                  <Badge
                    tone="brand"
                    className="max-w-full leading-snug whitespace-normal"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-current"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <TruncatedText
                      text={request.ticket_status_name}
                      lines={2}
                    />
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <RequestCell
                text={request.updating_user_name}
                className="text-center"
              />
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
