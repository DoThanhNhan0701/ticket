import { t, useLocale } from "@/i18n";
import { FilePenLine, Pencil } from "lucide-react";
import {
  DataTable,
  DataText,
  formatDataDate,
  type DataColumn,
} from "@/components/data-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPositionPermissionName } from "../utils/position-permissions";
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
      textColumn("username", t("settings", "Tên đăng nhập")),
      textColumn("msnv", t("common", "MSNV"), "120px"),
      textColumn("name", t("settings", "Họ và tên"), "220px"),
      textColumn("email", "Email", "250px"),
      lookupColumn(
        "bophan",
        "requesting-departments",
        t("common", "Department"),
        lookups,
      ),
      lookupColumn("team", "teams", t("common", "Team"), lookups),
      lookupColumn("chucvu", "positions", t("settings", "Chức vụ"), lookups),
      dateColumn("date_joined", t("settings", "Ngày tạo")),
      dateColumn("date_lock", t("settings", "Ngày khóa")),
      dateColumn("last_login", t("settings", "Đăng nhập gần nhất")),
    ];
  const columns = [textColumn("name", t("settings", "Tên"), "260px")];
  if (kind === "handling-departments")
    columns.push(
      textColumn(
        "username_manager",
        t("settings", "Người quản lý"),
        "180px",
        "center",
      ),
      textColumn("group_email", t("settings", "Email bộ phận"), "260px"),
    );
  if (kind === "request-types")
    columns.push(
      textColumn(
        "handling_group_name",
        t("settings", "Bộ phận xử lý"),
        "200px",
        "center",
      ),
    );
  if (kind === "teams")
    columns.push(
      lookupColumn(
        "bophan",
        "requesting-departments",
        t("common", "Department"),
        lookups,
      ),
    );
  if (kind === "positions")
    columns.push(textColumn("description", t("settings", "Mô tả"), "260px"), {
      id: "permission",
      label: t("settings", "Quyền hạn"),
      width: "300px",
      render: (row) => (
        <DataText
          text={row.permission
            ?.map((id) =>
              formatPositionPermissionName(
                lookups["position-permissions"]?.find(
                  (option) => option.id === id,
                )?.name ?? String(id),
              ),
            )
            .join(", ")}
        />
      ),
    });
  if (kind === "offices")
    columns.push(textColumn("slug_name", "Slug", "180px"));
  columns.push(
    dateColumn("created", t("settings", "Ngày tạo")),
    dateColumn("updated", t("settings", "Cập nhật")),
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
  useLocale();
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
      label: t("settings", "Trạng thái"),
      width: "140px",
      align: "center",
      render: (row) => (
        <Badge
          tone={row.is_active ? "success" : "neutral"}
          className="whitespace-nowrap"
        >
          {row.is_active ? t("settings", "Kích hoạt") : t("settings", "Khóa")}
        </Badge>
      ),
    },
    {
      id: "actions",
      label: t("settings", "Thao tác"),
      sticky: "right",
      width: kind === "request-types" ? "120px" : "90px",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("settings", "Chỉnh sửa {0}", [
              row.username ?? row.name,
            ])}
            title={t("settings", "Chỉnh sửa")}
            onClick={() => onEdit(row)}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          {kind === "request-types" && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("settings", "Biểu mẫu {0}", [row.name])}
              title={t("settings", "Biểu mẫu")}
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
      label={t("settings", "Bảng cấu hình")}
      scrollLabel={t("settings", "Cuộn bảng cấu hình")}
      getRowKey={(row) => row.id}
      scrollResetKey={scrollResetKey}
      className={kind === "users" ? "min-w-560" : "min-w-240"}
    />
  );
}
