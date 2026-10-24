import { t, useLocale } from "@/i18n";
import { ErrorToast } from "@/components/error-toast";
import { APP_ROUTES } from "@/constants/routes";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Download, FilterX, Info, Plus } from "lucide-react";
import {
  DataSearch,
  DataResults,
  parseListPagination,
  updateListSearchParams,
} from "@/components/data-management";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import {
  listSettingsRequest,
  settingsLookupsRequest,
} from "../api/settings-api";
import { settingsConfig } from "../utils/settings-config";
import type { SettingsKind, SettingsRecord } from "../types";
import { SettingsEditor } from "./settings-editor";
import { SettingsTable } from "./settings-table";
import { RequestTemplateEditor } from "./template-editor";
import { UserExportButton } from "./user-export-button";
import { PositionPermissionsHelp } from "./position-permissions-help";

const pageSizes = [100, 200] as const;
export function SettingsList({
  kind,
  createUser = false,
}: Readonly<{ kind: SettingsKind; createUser?: boolean }>) {
  useLocale();
  const { userId } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pagination = parseListPagination(searchParams, pageSizes);
  const params = {
    ...pagination,
    search: searchParams.get("search")?.trim() ?? "",
    status: ["true", "false"].includes(searchParams.get("is_active") ?? "")
      ? searchParams.get("is_active")!
      : "",
  };
  const config = settingsConfig[kind];
  const hasFilters = Boolean(params.search || params.status);
  const [editor, setEditor] = useState<{ record?: SettingsRecord } | null>(
    createUser ? {} : null,
  );
  const [template, setTemplate] = useState<SettingsRecord | null>(null);
  const [permissionHelpOpen, setPermissionHelpOpen] = useState(false);
  const query = useQuery({
    queryKey: ["settings", kind, userId, params],
    queryFn: ({ signal }) => listSettingsRequest(kind, params, signal),
    retry: false,
    placeholderData: (previous, old) =>
      old?.queryKey[1] === kind && old.queryKey[2] === userId
        ? previous
        : undefined,
  });
  const lookups = useQuery({
    queryKey: ["settings-lookups", userId, config.listLookups ?? []],
    queryFn: ({ signal }) =>
      settingsLookupsRequest(config.listLookups ?? [], signal),
    retry: false,
  });
  const update = (values: Record<string, string | number | undefined>) =>
    setSearchParams((current) => updateListSearchParams(current, values));
  useEffect(() => {
    if (!query.data || query.isPlaceholderData || query.data.count === 0)
      return;
    const last = Math.ceil(query.data.count / pagination.pageSize);
    if (pagination.page > last)
      setSearchParams(
        (current) => updateListSearchParams(current, { page: last }),
        { replace: true },
      );
  }, [
    query.data,
    query.isPlaceholderData,
    pagination.page,
    pagination.pageSize,
    setSearchParams,
  ]);
  const closeEditor = () => {
    setEditor(null);
    if (createUser) navigate(APP_ROUTES.settings.users, { replace: true });
  };
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <DataSearch
        iconOnlyOnMobile
        className="flex-none sm:max-w-none sm:justify-between"
        label={t("settings", "Tìm kiếm {0}", [config.label])}
        initialValue={params.search}
        resetKey={JSON.stringify(params)}
        filter={{
          label: t("settings", "Trạng thái"),
          initialValue: params.status || "all",
          searchable: true,
          allOptionValue: "all",
          options: [
            { value: "all", label: t("settings", "Tất cả trạng thái") },
            { value: "true", label: t("settings", "Kích hoạt") },
            { value: "false", label: t("settings", "Khóa") },
          ],
        }}
        onSearch={(search, status) =>
          update({
            search,
            is_active: status === "all" ? "" : status,
            page: 1,
          })
        }
        actions={
          <div className="flex shrink-0 items-center gap-2">
            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                aria-label={t("settings", "Xóa lọc")}
                title={t("settings", "Xóa lọc")}
                className="hidden w-11 px-0 sm:inline-flex lg:w-auto lg:px-4"
                onClick={() =>
                  update({ search: undefined, is_active: undefined, page: 1 })
                }
              >
                <FilterX className="size-4" aria-hidden="true" />
                <span className="hidden lg:inline">
                  {t("settings", "Xóa lọc")}
                </span>
              </Button>
            )}
            {kind === "positions" && (
              <Button
                type="button"
                variant="outline"
                aria-label={t("settings", "Thông tin quyền hạn")}
                title={t("settings", "Thông tin quyền hạn")}
                className="w-11 px-0 lg:w-auto lg:px-4"
                onClick={() => setPermissionHelpOpen(true)}
              >
                <Info className="size-4" aria-hidden="true" />
                <span className="hidden lg:inline">
                  {t("settings", "Thông tin quyền hạn")}
                </span>
              </Button>
            )}
            <Button
              type="button"
              aria-label={t("settings", "Thêm mới")}
              title={t("settings", "Thêm mới")}
              className="w-11 px-0 lg:w-auto lg:px-4"
              onClick={() => setEditor({})}
            >
              <Plus className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">
                {t("settings", "Thêm mới")}
              </span>
            </Button>
            {kind === "users" && <UserExportButton icon={Download} />}
          </div>
        }
      />
      {lookups.isError && (
        <ErrorToast
          message={t("settings", "Không tải được danh mục: {0}", [
            lookups.error.message,
          ])}
        />
      )}
      <DataResults
        refreshStyle="subtle"
        query={query}
        label={t("settings", "Danh sách {0}", [config.label])}
        emptyTitle={t("settings", "Không tìm thấy {0}", [config.label])}
        pagination={{
          ...pagination,
          pageSizes,
          itemLabel: config.label,
          onPage: (page) => update({ page }),
          onPageSize: (pageSize) => update({ page_size: pageSize, page: 1 }),
        }}
        renderRows={(rows) => (
          <SettingsTable
            kind={kind}
            rows={rows}
            lookups={lookups.data ?? {}}
            offset={(params.page - 1) * params.pageSize}
            scrollResetKey={JSON.stringify(params)}
            onEdit={(record) => setEditor({ record })}
            onTemplate={setTemplate}
          />
        )}
      />
      {kind === "positions" && (
        <PositionPermissionsHelp
          open={permissionHelpOpen}
          onOpenChange={setPermissionHelpOpen}
          permissions={lookups.data?.["position-permissions"] ?? []}
          loading={lookups.isPending}
          error={lookups.error}
        />
      )}
      {editor && (
        <SettingsEditor
          kind={kind}
          record={editor.record}
          onClose={closeEditor}
        />
      )}
      {template && (
        <RequestTemplateEditor
          record={template}
          onClose={() => setTemplate(null)}
        />
      )}
    </div>
  );
}
