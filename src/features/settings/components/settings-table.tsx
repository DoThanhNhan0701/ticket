import { FilePenLine, Pencil } from "lucide-react";
import {
  DataTable,
  DataText,
  formatDataDate,
  type DataColumn,
} from "@/components/data-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  LookupKind,
  SettingsKind,
  SettingsLookups,
  SettingsRecord,
} from "../types";

function textColumn(
  id: keyof SettingsRecord,
  label: string,
  width = "180px",
  align: "left" | "center" = "left",
): DataColumn<SettingsRecord> {
  return {
    id,
    label,
    width,
    align,
    render: (row) => <DataText text={String(row[id] ?? "")} />,
  };
}
function lookupColumn(
  id: "bophan" | "team" | "chucvu",
  kind: LookupKind,
  label: string,
  lookups: SettingsLookups,
): DataColumn<SettingsRecord> {
  return {
    id,
    label,
    width: "160px",
    align: "center",
    render: (row) => (
      <DataText
        text={
          lookups[kind]?.find((option) => option.id === row[id])?.name ??
          String(row[id] ?? "")
        }
      />
    ),
  };
}
function dateColumn(
  id: "created" | "updated" | "date_joined" | "date_lock" | "last_login",
  label: string,
): DataColumn<SettingsRecord> {
  return {
    id,
    label,
    width: "150px",
    align: "center",
    render: (row) => <DataText text={formatDataDate(row[id])} />,
  };
}
function entityColumns(
  kind: SettingsKind,
  lookups: SettingsLookups,
): DataColumn<SettingsRecord>[] {
  if (kind === "users")
    return [
      textColumn("username", "Tên đăng nhập"),
      textColumn("msnv", "MSNV", "120px"),
      textColumn("name", "Họ và tên", "220px"),
      textColumn("email", "Email", "250px"),
      lookupColumn("bophan", "requesting-departments", "Department", lookups),
      lookupColumn("team", "teams", "Team", lookups),
      lookupColumn("chucvu", "positions", "Chức vụ", lookups),
      dateColumn("date_joined", "Ngày tạo"),
      dateColumn("date_lock", "Ngày khóa"),
      dateColumn("last_login", "Đăng nhập gần nhất"),
    ];
  const columns = [textColumn("name", "Tên", "260px")];
  if (kind === "handling-departments")
    columns.push(
      textColumn("username_manager", "Người quản lý", "180px", "center"),
      textColumn("group_email", "Email bộ phận", "260px"),
    );
  if (kind === "request-types")
    columns.push(
      textColumn("handling_group_name", "Bộ phận xử lý", "200px", "center"),
    );
  if (kind === "teams")
    columns.push(
      lookupColumn("bophan", "requesting-departments", "Department", lookups),
    );
  if (kind === "positions")
    columns.push(textColumn("description", "Mô tả", "260px"), {
      id: "permission",
      label: "Quyền hạn",
      width: "300px",
      render: (row) => (
        <DataText
          text={row.permission
            ?.map(
              (id) =>
                lookups["position-permissions"]?.find(
                  (option) => option.id === id,
                )?.name ?? String(id),
            )
            .join(", ")}
        />
      ),
    });
  if (kind === "offices")
    columns.push(textColumn("slug_name", "Slug", "180px"));
  columns.push(
    dateColumn("created", "Ngày tạo"),
    dateColumn("updated", "Cập nhật"),
  );
  return columns;
}
export function SettingsTable({
  kind,
  rows,
  lookups,
  offset,
  scrollResetKey,
  onEdit,
  onTemplate,
}: Readonly<{
  kind: SettingsKind;
  rows: SettingsRecord[];
  lookups: SettingsLookups;
  offset: number;
  scrollResetKey: string;
  onEdit: (row: SettingsRecord) => void;
  onTemplate: (row: SettingsRecord) => void;
}>) {
  const columns: DataColumn<SettingsRecord>[] = [
    {
      id: "index",
      label: "#",
      width: "64px",
      align: "center",
      render: (_, index) => offset + index + 1,
    },
    ...entityColumns(kind, lookups),
    {
      id: "is_active",
      label: "Trạng thái",
      width: "140px",
      align: "center",
      render: (row) => (
        <Badge
          tone={row.is_active ? "success" : "neutral"}
          className="whitespace-nowrap"
        >
          {row.is_active ? "Kích hoạt" : "Khóa"}
        </Badge>
      ),
    },
    {
      id: "actions",
      label: "Thao tác",
      width: kind === "request-types" ? "120px" : "90px",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Chỉnh sửa ${row.username ?? row.name}`}
            title="Chỉnh sửa"
            onClick={() => onEdit(row)}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          {kind === "request-types" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Biểu mẫu ${row.name}`}
              title="Biểu mẫu"
              onClick={() => onTemplate(row)}
            >
              <FilePenLine className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      ),
    },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      label="Bảng cấu hình"
      scrollLabel="Cuộn bảng cấu hình"
      getRowKey={(row) => row.id}
      scrollResetKey={scrollResetKey}
      className={kind === "users" ? "min-w-560" : "min-w-240"}
    />
  );
}
