import { ErrorToast } from "@/components/error-toast";
import type { UseQueryResult } from "@tanstack/react-query";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import type { ReportResponse } from "../schemas/reports-schema";
import { ReportCharts } from "./report-charts";
import { ReportSummaryCards } from "./report-summary";

export function ReportResults({
  report,
}: Readonly<{ report: UseQueryResult<ReportResponse, Error> }>) {
  return (
    <>
      {report.isError && (
        <div className="space-y-2">
          <ErrorToast
            message={`Không tải được báo cáo: ${report.error.message}`}
          />
          <Button variant="outline" onClick={() => void report.refetch()}>
            Thử lại báo cáo
          </Button>
        </div>
      )}
      <section
        aria-label="Kết quả báo cáo"
        aria-busy={report.isFetching}
        className="relative min-w-0 space-y-4"
      >
        {report.isPending && <LoadingState message="Đang tải báo cáo..." />}
        {report.data && (
          <>
            <ReportSummaryCards data={report.data.dict_bieudo_01} />
            <ReportCharts report={report.data} />
          </>
        )}
        {report.isFetching && !report.isPending && (
          <LoadingState
            message="Đang cập nhật báo cáo..."
            className="absolute inset-0 z-20 rounded-xl bg-card/80"
          />
        )}
      </section>
    </>
  );
}
