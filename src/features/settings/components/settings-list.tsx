import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Download, FilterX, Plus } from "lucide-react";
import {
  DataSearch,
  DataResults,
  parseListPagination,
  updateListSearchParams,
} from "@/components/data-management";
import { ErrorAlert } from "@/components/error-alert";
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
    if (createUser) navigate("/settings/users", { replace: true });
  };
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <DataSearch
        iconOnlyOnMobile
        className="flex-none sm:max-w-none sm:justify-between"
        label={`Tìm kiếm ${config.label}`}
        initialValue={params.search}
        resetKey={JSON.stringify(params)}
        filter={{
          label: "Trạng thái",
          initialValue: params.status || "all",
          searchable: true,
          allOptionValue: "all",
          options: [
            { value: "all", label: "Tất cả trạng thái" },
            { value: "true", label: "Kích hoạt" },
            { value: "false", label: "Khóa" },
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
                aria-label="Xóa lọc"
                title="Xóa lọc"
                className="hidden w-11 px-0 sm:inline-flex lg:w-auto lg:px-4"
                onClick={() =>
                  update({ search: undefined, is_active: undefined, page: 1 })
                }
              >
                <FilterX className="size-4" aria-hidden="true" />
                <span className="hidden lg:inline">Xóa lọc</span>
              </Button>
            )}
            {kind === "positions" && (
              <PositionPermissionsHelp
                permissions={lookups.data?.["position-permissions"] ?? []}
                loading={lookups.isPending}
                error={lookups.error}
                onRetry={() => void lookups.refetch()}
              />
            )}
            <Button
              type="button"
              aria-label="Thêm mới"
              title="Thêm mới"
              className="w-11 px-0 lg:w-auto lg:px-4"
              onClick={() => setEditor({})}
            >
              <Plus className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">Thêm mới</span>
            </Button>
            {kind === "users" && <UserExportButton icon={Download} />}
          </div>
        }
      />
      {lookups.isError && (
        <div className="space-y-2">
          <ErrorAlert
            message={`Không tải được danh mục: ${lookups.error.message}`}
          />
          <Button variant="outline" onClick={() => void lookups.refetch()}>
            Thử lại danh mục
          </Button>
        </div>
      )}
      <DataResults
        query={query}
        label={`Danh sách ${config.label}`}
        emptyTitle={`Không tìm thấy ${config.label}`}
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
