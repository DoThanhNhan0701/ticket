import { t, useLocale } from "@/i18n";
import { ErrorToast } from "@/components/error-toast";
import type { UseQueryResult } from "@tanstack/react-query";
import { LoadingState } from "@/components/loading-state";
import type { ReportResponse } from "../schemas/reports-schema";
import { ReportCharts } from "./report-charts";
import { ReportSummaryCards } from "./report-summary";

export function ReportResults({
  report,
}: Readonly<{ report: UseQueryResult<ReportResponse, Error> }>) {
  useLocale();
  return (
    <>
      {report.isError && (
        <ErrorToast
          message={t("reports", "Không tải được báo cáo: {0}", [
            report.error.message,
          ])}
        />
      )}
      <section
        aria-label={t("reports", "Kết quả báo cáo")}
        aria-busy={report.isFetching}
        className="relative min-w-0 space-y-4"
      >
        {report.isPending && (
          <LoadingState message={t("reports", "Đang tải báo cáo...")} />
        )}
        {report.data && (
          <>
            <ReportSummaryCards data={report.data.dict_bieudo_01} />
            <ReportCharts report={report.data} />
          </>
        )}
        {report.isFetching && !report.isPending && (
          <LoadingState
            message={t("reports", "Đang cập nhật báo cáo...")}
            className="absolute inset-0 z-20 rounded-xl bg-card/80"
          />
        )}
      </section>
    </>
  );
}
