import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import {
  DataClientResults,
  DataTable,
  DataText,
  formatDataDate,
  type DataColumn,
} from "@/components/data-management";
import { ErrorAlert } from "@/components/error-alert";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { downloadFile } from "@/lib/download";
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
  ["result_rect", "Theo yêu cầu tuyển dụng"],
  ["result_department", "Theo bộ phận"],
  ["result_hr", "Theo người phụ trách"],
  ["result_time_recruitment", "Thời gian tuyển dụng"],
  ["result_candidate_source", "Theo nguồn ứng viên"],
  ["result_cv_conversion_rate", "Tỷ lệ chuyển đổi CV"],
  ["result_cv_status", "Trạng thái CV"],
  ["result_department_month", "Bộ phận theo tháng"],
] as const;
const labels: Record<string, string> = {
  ticket_code: "Mã yêu cầu",
  rec_position: "Vị trí tuyển dụng",
  department_recruited: "Bộ phận",
  department_recruited_name: "Bộ phận",
  username: "Người phụ trách",
  number_cv_all: "Số lượng CV",
  quantity: "Số lượng yêu cầu",
  number_cv_pass: "Đã nhận việc",
  rate_pass: "Tỷ lệ đạt",
  candidate_source__name: "Nguồn ứng viên",
  created: "Ngày tạo",
  time_close: "Ngày đóng",
  cv_status__name: "Trạng thái CV",
  name: "Tên",
  month: "Tháng",
  value: "Số lượng",
  count: "Số lượng",
  rate: "Tỷ lệ",
  number_cv: "Số lượng CV",
};
export function RecruitmentReport() {
  const { userId } = useAuthContext();
  const [paginationReset, resetPagination] = useState(0);
  const [filters, setFilters] = useState(defaultRecruitmentDates);
  const [tab, setTab] = useState<string>(sections[0][0]);
  const query = useQuery({
    queryKey: ["recruitment-report", userId, filters],
    queryFn: ({ signal }) =>
      recruitmentObject("/report_rect/", filters, signal),
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
      recruitmentArray("/list_status_cv/", undefined, signal),
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
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter(
    (key) =>
      Object.prototype.hasOwnProperty.call(labels, key) &&
      rows.some(
        (row) => typeof row[key] === "string" || typeof row[key] === "number",
      ),
  );
  const columns: DataColumn<RecruitmentRow>[] = keys.map((key) => ({
    id: key,
    label:
      key === "rate_pass" && tab === "result_time_recruitment"
        ? "Thời gian tuyển dụng (ngày)"
        : labels[key],
    render: (row) => (
      <DataText
        text={
          ["created", "time_close"].includes(key)
            ? formatDataDate(recruitmentText(row[key]))
            : recruitmentText(row[key])
        }
      />
    ),
  }));
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
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
            type="button"
            variant="outline"
            loading={exporting.isPending}
            disabled={!query.data || query.isError}
            icon={<Download className="size-4" />}
            onClick={() => {
              if (!exporting.isPending) exporting.mutate();
            }}
          >
            Xuất Excel
          </AsyncButton>
        }
      />

      {exporting.isError && <ErrorAlert message={exporting.error.message} />}
      <div
        className="flex flex-wrap gap-2 rounded-xl border bg-card p-2"
        role="tablist"
        aria-label="Báo cáo tuyển dụng"
      >
        {sections.map(([key, label]) => (
          <Button
            key={key}
            id={`recruitment-report-${key}`}
            role="tab"
            tabIndex={tab === key ? 0 : -1}
            aria-selected={tab === key}
            aria-controls="recruitment-report-panel"
            variant={tab === key ? "default" : "ghost"}
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
            {label}
          </Button>
        ))}
      </div>
      <section
        id="recruitment-report-panel"
        role="tabpanel"
        aria-label={sections.find(([key]) => key === tab)?.[1]}
        className="flex min-h-64 flex-1 flex-col gap-4 rounded-xl border bg-card p-4"
      >
        {!query.isPending && !query.isError && rows.length > 0 && (
          <>
            <div className="flex flex-wrap gap-3">
              {["number_cv_all", "quantity", "number_cv_pass"]
                .filter((key) =>
                  rows.some((row) => Number.isFinite(Number(row[key]))),
                )
                .map((key) => (
                  <div
                    key={key}
                    className="min-w-40 rounded-xl border bg-muted/30 p-4"
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
            <RecruitmentChart rows={rows} />
          </>
        )}
        <DataClientResults
          scopeKey={JSON.stringify([tab, filters, paginationReset])}
          query={{
            ...query,
            data: query.data
              ? { results: rows, count: rows.length }
              : undefined,
          }}
          label="Kết quả báo cáo tuyển dụng"
          itemLabel="bản ghi"
          loadingMessage="Đang tải báo cáo tuyển dụng..."
          errorPrefix="Không tải được báo cáo tuyển dụng"
          emptyTitle="Không có dữ liệu báo cáo trong khoảng thời gian đã chọn."
          renderRows={(visibleRows, offset) => (
            <DataTable
              scrollLabel="Cuộn bảng tuyển dụng"
              rows={visibleRows}
              columns={columns}
              label="Bảng báo cáo tuyển dụng"
              getRowKey={(row) => JSON.stringify(row)}
              scrollResetKey={`${offset}:${visibleRows.length}`}
            />
          )}
        />
      </section>
    </div>
  );
}
