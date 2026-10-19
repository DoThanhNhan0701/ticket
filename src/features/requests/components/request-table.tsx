import {
  DataTable,
  DataText,
  DataRowLink,
  formatDataDate,
  type DataColumn,
} from "@/components/data-management";
import { Badge } from "@/components/ui/badge";
import type { RequestListScope, RequestTicket } from "../types";

const getRequestHref = (request: RequestTicket) =>
  `/tickets/${encodeURIComponent(String(request.id))}`;

function RequestStatus({ request }: Readonly<{ request: RequestTicket }>) {
  if (!request.ticket_status_name) return <>—</>;
  const color =
    request.color && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(request.color)
      ? request.color
      : undefined;
  return (
    <Badge tone="brand" className="max-w-full leading-snug whitespace-normal">
      <span
        className="size-1.5 shrink-0 rounded-full bg-current"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <DataText text={request.ticket_status_name} />
    </Badge>
  );
}

const columns: readonly DataColumn<RequestTicket>[] = [
  {
    id: "ticket_code",
    label: "Mã yêu cầu",
    width: "14%",
    render: (request) => (
      <DataRowLink
        to={getRequestHref(request)}
        text={request.ticket_code || String(request.id)}
        className="text-brand-700 dark:text-brand-200"
      />
    ),
  },
  {
    id: "ticket_type_name",
    label: "Loại yêu cầu",
    width: "13%",
    render: (request) => <DataText text={request.ticket_type_name} />,
  },
  {
    id: "title",
    label: "Tiêu đề",
    width: "18%",
    render: (request) => (
      <DataRowLink to={getRequestHref(request)} text={request.title} />
    ),
  },
  {
    id: "department",
    label: "Department",
    width: "8%",
    align: "center",
    render: (request) => <DataText text={request.bophansudung_name} />,
  },
  {
    id: "team",
    label: "Team",
    width: "4%",
    align: "center",
    render: (request) => (
      <DataText
        text={request.list_name_team_use.map((team) => team.name).join(", ")}
      />
    ),
  },
  {
    id: "office",
    label: "Văn phòng",
    width: "9%",
    render: (request) => <DataText text={request.vanphong_name} />,
  },
  {
    id: "duedate",
    label: "Ngày mong muốn",
    width: "8%",
    align: "center",
    className: "tabular-nums",
    render: (request) => <DataText text={formatDataDate(request.duedate)} />,
  },
  {
    id: "approver",
    label: "Người phê duyệt",
    width: "7%",
    align: "center",
    render: (request) => <DataText text={request.approve_user_name} />,
  },
  {
    id: "status",
    label: "Trạng thái",
    width: "8%",
    align: "center",
    render: (request) => <RequestStatus request={request} />,
  },
  {
    id: "updater",
    label: "Cập nhật bởi",
    width: "7%",
    align: "center",
    render: (request) => <DataText text={request.updating_user_name} />,
  },
];

const allColumnWidths: Readonly<Record<string, string>> = {
  ticket_code: "16%",
  ticket_type_name: "14%",
  title: "22%",
  office: "10%",
  duedate: "9%",
  status: "8%",
  updater: "8%",
};
const allColumns: readonly DataColumn<RequestTicket>[] = columns
  .filter(({ id }) => id !== "department" && id !== "team")
  .map((column) => {
    if (column.id === "approver")
      return {
        id: "handler",
        label: "Người xử lý",
        width: "9%",
        align: "center",
        render: (request) => <DataText text={request.list_user_received} />,
      };
    return { ...column, width: allColumnWidths[column.id] };
  });

export function RequestTable({
  rows,
  rowOffset,
  scope = "created",
  scrollResetKey,
}: Readonly<{
  rows: RequestTicket[];
  rowOffset: number;
  scope?: RequestListScope;
  scrollResetKey?: string;
}>) {
  return (
    <DataTable
      rows={rows}
      columns={[
        {
          id: "row_number",
          label: "#",
          width: "4%",
          align: "center",
          className: "tabular-nums",
          render: (_request, index) => (
            <DataText text={String(rowOffset + index + 1)} />
          ),
        },
        ...(scope === "all" ? allColumns : columns),
      ]}
      label={scope === "all" ? "Tất cả yêu cầu" : "Danh sách yêu cầu"}
      scrollLabel="Cuộn bảng yêu cầu"
      scrollResetKey={scrollResetKey}
      getRowKey={(request) => request.id}
      getRowHref={getRequestHref}
      className="min-w-352"
    />
  );
}
