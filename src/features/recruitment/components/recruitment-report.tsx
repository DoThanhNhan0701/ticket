import { t, useLocale } from "@/i18n";
import { ErrorToast } from "@/components/error-toast";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CircleCheck,
  Clock3,
  Download,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import {
  DataClientResults,
  DataTable,
  DataText,
  formatDataDate,
  type DataColumn,
} from "@/components/data-management";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { downloadFile } from "@/lib/download";
import { cn } from "@/lib/utils";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import {
  recruitmentObject,
  exportRecruitment,
  recruitmentArray,
} from "../api/recruitment-api";
import {
  defaultRecruitmentDates,
  recruitmentRows,
  recruitmentText,
} from "../utils/recruitment-format";
import type { RecruitmentRow } from "../types";
import { RecruitmentChart } from "./recruitment-chart";
import { RecruitmentFilters } from "./recruitment-filters";
const sections = [
  ["result_rect", "Theo yêu cầu tuyển dụng", BriefcaseBusiness],
  ["result_department", "Theo bộ phận", Building2],
  ["result_hr", "Theo người phụ trách", UserRoundCheck],
  ["result_time_recruitment", "Thời gian tuyển dụng", Clock3],
  ["result_candidate_source", "Theo nguồn ứng viên", Users],
  ["result_cv_conversion_rate", "Tỷ lệ chuyển đổi CV", ChartNoAxesCombined],
  ["result_cv_status", "Trạng thái CV", CircleCheck],
  ["result_department_month", "Bộ phận theo tháng", CalendarDays],
] as const;
const labels: Record<string, string> = {
  get ticket_code() {
    return t("recruitment-reports", "Mã yêu cầu");
  },
  get rec_position() {
    return t("recruitment-reports", "Vị trí tuyển dụng");
  },
  get department_recruited() {
    return t("recruitment-reports", "Bộ phận");
  },
  get department_recruited_name() {
    return t("recruitment-reports", "Bộ phận");
  },
  get username() {
    return t("recruitment-reports", "Người phụ trách");
  },
  get number_cv_all() {
    return t("recruitment-reports", "Số lượng CV");
  },
  get quantity() {
    return t("recruitment-reports", "Số lượng yêu cầu");
  },
  get number_cv_pass() {
    return t("recruitment-reports", "Đã nhận việc");
  },
  get rate_pass() {
    return t("recruitment-reports", "Tỷ lệ đạt");
  },
  get candidate_source__name() {
    return t("recruitment-reports", "Nguồn ứng viên");
  },
  get created() {
    return t("recruitment-reports", "Ngày tạo");
  },
  get time_close() {
    return t("recruitment-reports", "Ngày đóng");
  },
  get cv_status__name() {
    return t("recruitment-reports", "Trạng thái CV");
  },
  get name() {
    return t("recruitment-reports", "Tên");
  },
  get month() {
    return t("recruitment-reports", "Tháng");
  },
  get value() {
    return t("recruitment-reports", "Số lượng");
  },
  get count() {
    return t("recruitment-reports", "Số lượng");
  },
  get rate() {
    return t("recruitment-reports", "Tỷ lệ");
  },
  get number_cv() {
    return t("recruitment-reports", "Số lượng CV");
  },
};
export function RecruitmentReport() {
  useLocale();
  const { ref: tabsRef, isDragging, handlers: dragHandlers } = useDragScroll();
  const { userId } = useAuthContext();
  const [paginationReset, resetPagination] = useState(0);
  const [filters, setFilters] = useState(defaultRecruitmentDates);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab =
    sections.find(([key]) => key === searchParams.get("tab"))?.[0] ??
    sections[0][0];
  const setTab = (key: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("tab", key);
        return next;
      },
      { preventScrollReset: true },
    );
  };
  useEffect(() => {
    const container = tabsRef.current;
    const active = container?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    if (!container || !active || !container.clientWidth) return;
    if (active.offsetLeft < container.scrollLeft) {
      container.scrollLeft = active.offsetLeft;
    } else if (
      active.offsetLeft + active.offsetWidth >
      container.scrollLeft + container.clientWidth
    ) {
      container.scrollLeft =
        active.offsetLeft + active.offsetWidth - container.clientWidth;
    }
  }, [tab, tabsRef]);
  const query = useQuery({
    queryKey: ["recruitment-report", userId, filters],
    queryFn: ({ signal }) =>
      recruitmentObject(API_ENDPOINTS.recruitment.report, filters, signal),
    placeholderData: (previous, old) =>
      old?.queryKey[1] === userId ? previous : undefined,
    retry: false,
  });
  const exporting = useMutation({
    mutationFn: () => exportRecruitment("reports", filters),
    onSuccess: (blob) =>
      downloadFile(
        blob,
        `Report_Recruitment_${filters.from_date}_${filters.to_date}.xlsx`,
      ),
    retry: false,
  });
  const statuses = useQuery({
    queryKey: ["recruitment-report-statuses", userId],
    queryFn: ({ signal }) =>
      recruitmentArray(API_ENDPOINTS.recruitment.statuses, undefined, signal),
    retry: false,
  });
  let rows = recruitmentRows(query.data?.[tab]);
  if (
    tab === "result_cv_status" &&
    query.data?.result_cv_status &&
    !Array.isArray(query.data.result_cv_status)
  ) {
    rows = Object.entries(
      query.data.result_cv_status as Record<string, unknown>,
    )
      .filter(([, value]) => Array.isArray(value))
      .map(([id, value]) => ({
        id: Number(id),
        name: recruitmentText(
          statuses.data?.find((status) => String(status.id) === id)?.name,
        ),
        number_cv: Array.isArray(value) ? value[0] : 0,
      }));
  }
  const hasRows = Boolean(query.data) && rows.length > 0;
  const summaryKeys = ["number_cv_all", "quantity", "number_cv_pass"].filter(
    (key) => rows.some((row) => Number.isFinite(Number(row[key]))),
  );
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter(
    (key) =>
      Object.prototype.hasOwnProperty.call(labels, key) &&
      rows.some(
        (row) => typeof row[key] === "string" || typeof row[key] === "number",
      ),
  );
  const columns: DataColumn<RecruitmentRow>[] = keys.map((key) => ({
    id: key,
    width: reportColumnWidth(key),
    align: [
      "number_cv_all",
      "number_cv",
      "number_cv_pass",
      "quantity",
      "rate_pass",
      "rate",
      "count",
      "value",
    ].includes(key)
      ? "right"
      : "left",
    label:
      key === "rate_pass" && tab === "result_time_recruitment"
        ? t("recruitment-reports", "Thời gian tuyển dụng (ngày)")
        : labels[key],
    render: (row) => {
      let text = recruitmentText(row[key]);
      if (["created", "time_close"].includes(key)) text = formatDataDate(text);
      if (key === "cv_status__name") text = t("statuses", text);
      return <DataText text={text} />;
    },
  }));
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3",
        hasRows ? "shrink-0 pb-6" : "min-h-0 flex-1",
      )}
    >
      <RecruitmentFilters
        values={filters}
        lookups={{}}
        mode="reports"
        busy={query.isFetching}
        onApply={(values) => {
          resetPagination((current) => current + 1);
          if (
            values.from_date === filters.from_date &&
            values.to_date === filters.to_date
          )
            void query.refetch();
          else
            setFilters({
              from_date: values.from_date,
              to_date: values.to_date,
            });
        }}
        onReset={() => {
          resetPagination((current) => current + 1);
          setFilters(defaultRecruitmentDates());
        }}
        actions={
          <AsyncButton
            mobileIconOnly
            title={t("recruitment-reports", "Xuất Excel")}
            type="button"
            variant="outline"
            loading={exporting.isPending}
            disabled={!query.data || query.isError || query.isPlaceholderData}
            icon={<Download className="size-4" />}
            onClick={() => {
              if (!exporting.isPending) exporting.mutate();
            }}
          >
            {t("recruitment-reports", "Xuất Excel")}
          </AsyncButton>
        }
      />

      {exporting.isError && <ErrorToast message={exporting.error.message} />}
      <div
        ref={tabsRef}
        {...dragHandlers}
        className={`recruitment-report-tabs relative grid min-w-0 shrink-0 auto-cols-[minmax(14rem,1fr)] grid-flow-col gap-1 overflow-x-auto rounded-xl border bg-card p-2 select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        role="tablist"
        aria-label={t("recruitment-reports", "Báo cáo tuyển dụng")}
      >
        {sections.map(([key, label, Icon]) => (
          <Button
            key={key}
            id={`recruitment-report-${key}`}
            role="tab"
            tabIndex={tab === key ? 0 : -1}
            aria-selected={tab === key}
            aria-controls="recruitment-report-panel"
            variant={tab === key ? "default" : "ghost"}
            className="min-w-0 w-full cursor-inherit transition-colors motion-reduce:transition-none"
            onKeyDown={(event) => {
              const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
              if (!keys.includes(event.key)) return;
              event.preventDefault();
              const current = sections.findIndex(([name]) => name === tab);
              let index = (current + 1) % sections.length;
              if (event.key === "ArrowLeft")
                index = (current + sections.length - 1) % sections.length;
              if (event.key === "Home") index = 0;
              if (event.key === "End") index = sections.length - 1;
              setTab(sections[index][0]);
              document
                .getElementById(`recruitment-report-${sections[index][0]}`)
                ?.focus();
            }}
            onClick={() => setTab(key)}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t("recruitment-reports", label)}
          </Button>
        ))}
      </div>
      <section
        id="recruitment-report-panel"
        role="tabpanel"
        aria-label={t(
          "recruitment-reports",
          sections.find(([key]) => key === tab)![1],
        )}
        className={cn(
          "flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-3 sm:p-4",
          hasRows ? "shrink-0" : "min-h-0 flex-1",
        )}
      >
        {hasRows && (
          <>
            {summaryKeys.length > 0 && (
              <div
                key={`stats-${tab}`}
                className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-3"
              >
                {summaryKeys.map((key) => (
                  <div
                    key={key}
                    className="min-w-0 rounded-xl border border-primary/15 bg-linear-to-br from-primary/5 to-card p-4"
                  >
                    <p className="text-xs text-muted-foreground">
                      {labels[key]}
                    </p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {rows.reduce(
                        (total, row) => total + (Number(row[key]) || 0),
                        0,
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <RecruitmentChart key={`chart-${tab}`} rows={rows} section={tab} />
          </>
        )}
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col",
            hasRows ? "h-[clamp(22rem,50vh,36rem)]" : "flex-1",
          )}
        >
          <DataClientResults
            refreshStyle="subtle"
            scopeKey={JSON.stringify([tab, filters, paginationReset])}
            query={{
              ...query,
              data: query.data
                ? { results: rows, count: rows.length }
                : undefined,
            }}
            label={t("recruitment-reports", "Kết quả báo cáo tuyển dụng")}
            itemLabel={t("recruitment-reports", "bản ghi")}
            loadingMessage={t(
              "recruitment-reports",
              "Đang tải báo cáo tuyển dụng...",
            )}
            errorPrefix={t(
              "recruitment-reports",
              "Không tải được báo cáo tuyển dụng",
            )}
            emptyTitle={t(
              "recruitment-reports",
              "Không có dữ liệu báo cáo trong khoảng thời gian đã chọn.",
            )}
            renderRows={(visibleRows, offset) => (
              <DataTable
                className="min-w-[48rem]"
                scrollLabel={t("recruitment-reports", "Cuộn bảng tuyển dụng")}
                rows={visibleRows}
                columns={columns}
                label={t("recruitment-reports", "Bảng báo cáo tuyển dụng")}
                getRowKey={reportRowKey}
                scrollResetKey={JSON.stringify([tab, filters, offset])}
              />
            )}
          />
        </div>
      </section>
    </div>
  );
}

function reportColumnWidth(key: string) {
  if (["created", "time_close"].includes(key)) return "160px";
  if (
    [
      "rec_position",
      "department_recruited",
      "department_recruited_name",
      "name",
      "candidate_source__name",
    ].includes(key)
  )
    return "220px";
  return "150px";
}

function reportRowKey(row: RecruitmentRow) {
  const dimensions = recruitmentText(row.id)
    ? ["id", "rec_position", "month"]
    : [
        "ticket_code",
        "rec_position",
        "department_recruited",
        "department_recruited_name",
        "username",
        "candidate_source__name",
        "cv_status__name",
        "name",
        "month",
      ];
  const identity = dimensions.map((key) => recruitmentText(row[key]));
  return identity.some(Boolean)
    ? JSON.stringify(identity)
    : JSON.stringify(row);
}
