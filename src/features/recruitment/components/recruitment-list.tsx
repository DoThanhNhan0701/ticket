import { t, useLocale } from "@/i18n";
import { ErrorToast } from "@/components/error-toast";
import { PAGE_LINKS } from "@/constants/routes";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Download, CalendarPlus } from "lucide-react";
import {
  DataResults,
  DataTable,
  DataText,
  formatDataDate,
  parseListPagination,
  updateListSearchParams,
  type DataColumn,
} from "@/components/data-management";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { downloadFile } from "@/lib/download";
import type {
  RecruitmentKind,
  RecruitmentRow,
  RecruitmentEditorState,
  RecruitmentAction,
} from "../types";
import { listRecruitment, exportRecruitment } from "../api/recruitment-api";
import {
  recruitmentText as text,
  defaultRecruitmentDates,
  names,
} from "../utils/recruitment-format";
import { useRecruitmentLookups } from "../hooks/use-recruitment-lookups";
import { RecruitmentEditor } from "./recruitment-editor";
import {
  RecruitmentActionChooser,
  RecruitmentRowActions,
} from "./recruitment-row-actions";
import { RecruitmentFilters } from "./recruitment-filters";
import { RecruitmentStatusBadge } from "./recruitment-status-badge";
const pageSizes = [100, 200] as const;
export function RecruitmentList({ kind }: Readonly<{ kind: RecruitmentKind }>) {
  useLocale();
  const { userId } = useAuthContext();
  const [params, setParams] = useSearchParams();
  const pagination = parseListPagination(params, pageSizes);
  const defaults = defaultRecruitmentDates();
  const filters = Object.fromEntries(
    [
      "from_date",
      "to_date",
      "title",
      "search",
      "department_recruited",
      "cv_status",
      "ticket_code",
      "user_received",
      "ticket_status",
    ].map((key) => [
      key,
      params.get(key) ?? defaults[key as keyof typeof defaults] ?? "",
    ]),
  );
  const apiParams = {
    ...filters,
    page: String(pagination.page),
    page_size: String(pagination.pageSize),
  };
  const [editor, setEditor] = useState<RecruitmentEditorState | null>(null);
  const [actionRow, setActionRow] = useState<RecruitmentRow | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const selectionScope = params.toString();
  useEffect(() => {
    setSelected((current) => (current.length ? [] : current));
  }, [selectionScope]);
  const query = useQuery({
    queryKey: ["recruitment-list", kind, userId, apiParams],
    queryFn: ({ signal }) => listRecruitment(kind, apiParams, signal),
    retry: false,
    placeholderData: (previous, old) =>
      old?.queryKey[1] === kind && old.queryKey[2] === userId
        ? previous
        : undefined,
  });
  const lookups = useRecruitmentLookups();
  const update = (values: Record<string, string | number | undefined>) => {
    setSelected([]);
    setParams((current) => updateListSearchParams(current, values));
  };
  useEffect(() => {
    if (
      query.data &&
      !query.isPlaceholderData &&
      pagination.page > 1 &&
      pagination.page >
        Math.max(1, Math.ceil(query.data.count / pagination.pageSize))
    )
      setParams(
        (current) =>
          updateListSearchParams(current, {
            page: Math.max(
              1,
              Math.ceil(query.data!.count / pagination.pageSize),
            ),
          }),
        { replace: true },
      );
  }, [
    query.data,
    query.isPlaceholderData,
    pagination.page,
    pagination.pageSize,
    setParams,
  ]);
  const exportFile = useMutation({
    mutationFn: () => exportRecruitment(kind, filters),
    onSuccess: (blob) =>
      downloadFile(
        blob,
        `Recruitment_${kind}_${filters.from_date}_${filters.to_date}.xlsx`,
      ),
    retry: false,
  });
  const open = (action: RecruitmentAction, row: RecruitmentRow) =>
    setEditor({ action, row });
  const toggleSelection = (id: number, checked: boolean) =>
    setSelected((current) =>
      checked
        ? [...new Set([...current, id])]
        : current.filter((selectedId) => selectedId !== id),
    );
  const rowActionsDisabled = !lookups.data || query.isFetching || query.isError;
  const editorContent =
    editor && lookups.data ? (
      <RecruitmentEditor
        state={editor}
        lookups={lookups.data}
        onClose={() => {
          setEditor(null);
          setSelected([]);
        }}
      />
    ) : null;
  const columns: DataColumn<RecruitmentRow>[] = [
    {
      id: "index",
      label: "#",
      width: kind === "candidates" ? "88px" : "60px",
      render: (row, index) => (
        <div className="flex items-center gap-3">
          {kind === "candidates" && (
            <Checkbox
              aria-label={t("recruitment", "Chọn CV {0}", [text(row.code_cv)])}
              checked={selected.includes(row.id!)}
              disabled={query.isFetching || !row.id}
              onCheckedChange={(checked) => toggleSelection(row.id!, checked)}
            />
          )}
          <span className="min-w-[2ch] tabular-nums">
            {(pagination.page - 1) * pagination.pageSize + index + 1}
          </span>
        </div>
      ),
    },
    {
      id: "ticket_code",
      label: t("recruitment", "Mã yêu cầu"),
      width: "150px",
      render: (row) => {
        const id = String(row.link_ticket ?? "")
          .split("/")
          .filter(Boolean)
          .slice(-1)[0];
        return id && /^\d+$/.test(id) ? (
          <Link
            className="text-primary underline"
            to={PAGE_LINKS.requestDetail(id)}
          >
            {text(row.ticket_code)}
          </Link>
        ) : (
          <DataText text={text(row.ticket_code)} />
        );
      },
    },
    ...(kind === "requests"
      ? [
          {
            id: "title",
            label: t("recruitment", "Tiêu đề"),
            width: "220px",
            render: (row: RecruitmentRow) => (
              <DataText text={text(row.title)} />
            ),
          },
        ]
      : [
          {
            id: "code_cv",
            label: t("recruitment", "Mã CV"),
            width: "150px",
            render: (row: RecruitmentRow) => (
              <DataText text={text(row.code_cv)} />
            ),
          },
          {
            id: "first_name",
            label: t("recruitment", "Họ và tên"),
            width: "180px",
            render: (row: RecruitmentRow) => (
              <Button
                variant="link"
                className="h-auto max-w-full justify-start p-0 text-left"
                disabled={rowActionsDisabled}
                onClick={() => open("candidate", row)}
              >
                <DataText text={text(row.first_name)} />
              </Button>
            ),
          },
        ]),
    {
      id: "position",
      label: t("recruitment", "Vị trí tuyển dụng"),
      width: "170px",
      render: (row) => (
        <DataText
          text={text(
            kind === "requests" ? row.rec_position : row.cv_rec_position,
          )}
        />
      ),
    },
    {
      id: "department",
      label: t("recruitment", "Bộ phận"),
      width: "120px",
      render: (row) => <DataText text={text(row.department_recruited_name)} />,
    },
    ...(kind === "requests"
      ? [
          {
            id: "quantity",
            label: t("recruitment", "Số lượng"),
            width: "80px",
            render: (row: RecruitmentRow) => (
              <DataText text={text(row.quantity)} />
            ),
          },
          {
            id: "duedate",
            label: t("recruitment", "Ngày hết hạn"),
            width: "130px",
            render: (row: RecruitmentRow) => (
              <DataText text={formatDataDate(text(row.duedate))} />
            ),
          },
        ]
      : [
          {
            id: "numberphone",
            label: t("recruitment", "Số điện thoại"),
            width: "135px",
            render: (row: RecruitmentRow) => (
              <DataText text={text(row.numberphone)} />
            ),
          },
          {
            id: "email",
            label: "Email",
            width: "190px",
            render: (row: RecruitmentRow) => (
              <DataText text={text(row.email)} />
            ),
          },
        ]),
    {
      id: "received",
      label: t("recruitment", "Người phụ trách"),
      width: "150px",
      render: (row) => <DataText text={names(row.detail_user_received)} />,
    },
    {
      id: "status",
      label: t("recruitment", "Trạng thái"),
      width: "140px",
      render: (row) =>
        kind === "requests" ? (
          <Badge tone="brand">
            {t("statuses", text(row.ticket_status_name))}
          </Badge>
        ) : (
          <RecruitmentStatusBadge status={row.cv_status_name} />
        ),
    },
    {
      id: "actions",
      label: t("recruitment", "Thao tác"),
      width: "80px",
      sticky: "right",
      render: (row) => (
        <RecruitmentRowActions
          mode={kind}
          row={row}
          disabled={rowActionsDisabled}
          onAction={open}
          open={false}
          onOpenChange={(nextOpen) => {
            if (nextOpen) setActionRow(row);
          }}
        />
      ),
    },
  ];
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <RecruitmentFilters
        values={filters}
        lookups={lookups.data ?? {}}
        mode={kind}
        busy={query.isFetching}
        onApply={(values) => {
          const applied = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, value.trim()]),
          );
          if (
            pagination.page === 1 &&
            Object.entries(applied).every(
              ([key, value]) => filters[key] === value,
            )
          )
            void query.refetch();
          else update({ ...applied, page: 1 });
        }}
        onReset={() => {
          setSelected([]);
          setParams({});
        }}
        actions={
          <>
            {kind === "candidates" && (
              <Button
                mobileIconOnly
                title={t("recruitment", "Gắn lịch phỏng vấn")}
                type="button"
                variant="outline"
                disabled={!selected.length || rowActionsDisabled}
                onClick={() =>
                  setEditor({ action: "attach", row: {}, ids: selected })
                }
              >
                <CalendarPlus className="size-4" />
                {t("recruitment", "Gắn lịch ({0})", [selected.length])}
              </Button>
            )}
            <AsyncButton
              mobileIconOnly
              title={t("recruitment", "Xuất Excel")}
              type="button"
              variant="outline"
              loading={exportFile.isPending}
              icon={<Download className="size-4" />}
              onClick={() => {
                if (!exportFile.isPending) exportFile.mutate();
              }}
            >
              {t("recruitment", "Xuất Excel")}
            </AsyncButton>
          </>
        }
      />

      {lookups.isError && <ErrorToast message={lookups.error.message} />}
      {exportFile.isError && <ErrorToast message={exportFile.error.message} />}
      <DataResults
        refreshStyle="subtle"
        query={query}
        label={
          kind === "requests"
            ? t("recruitment", "Danh sách yêu cầu tuyển dụng")
            : t("recruitment", "Danh sách ứng viên")
        }
        emptyTitle={
          kind === "requests"
            ? t("recruitment", "Không tìm thấy yêu cầu tuyển dụng")
            : t("recruitment", "Không tìm thấy ứng viên")
        }
        pagination={{
          ...pagination,
          pageSizes,
          itemLabel:
            kind === "requests"
              ? t("recruitment", "yêu cầu")
              : t("recruitment", "ứng viên"),
          onPage: (page) => update({ page }),
          onPageSize: (pageSize) => update({ page_size: pageSize, page: 1 }),
        }}
        renderRows={(rows) => (
          <DataTable
            scrollLabel={t("recruitment", "Cuộn bảng tuyển dụng")}
            rows={rows}
            columns={columns}
            label={
              kind === "requests"
                ? t("recruitment", "Bảng yêu cầu tuyển dụng")
                : t("recruitment", "Bảng ứng viên")
            }
            getRowKey={(row) => String(row.id)}
            scrollResetKey={JSON.stringify(apiParams)}
          />
        )}
      />
      {!editor?.row.id && editorContent}
      <RecruitmentActionChooser
        mode={kind}
        row={actionRow}
        rows={query.data?.results}
        disabled={rowActionsDisabled}
        onClose={() => setActionRow(null)}
        onAction={open}
      >
        {editorContent}
      </RecruitmentActionChooser>
    </div>
  );
}
