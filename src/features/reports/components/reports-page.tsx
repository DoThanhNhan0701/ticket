import { ErrorToast } from "@/components/error-toast";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { downloadFile } from "@/lib/download";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  listReportGroupsRequest,
  getReportRequest,
  exportReportRequest,
  exportReportDataRequest,
} from "../api/reports-api";
import type { ReportFilters } from "../schemas/reports-schema";
import {
  getDefaultReportFilters,
  getVisibleReportGroups,
  getReportFilename,
  type ReportMode,
} from "../utils/report-options";
import { ReportFiltersForm } from "./report-filters";
import { ReportResults } from "./report-results";

export function ReportsPage({
  mode = "dashboard",
}: Readonly<{ mode?: ReportMode }>) {
  const { userId, permissions } = useAuthContext();
  const defaults = useMemo(() => getDefaultReportFilters(mode), [mode]);
  const [applied, setApplied] = useState<ReportFilters | null>(null);
  const exporting = useRef(false);
  const groupsQuery = useQuery({
    queryKey: ["report-groups", userId],
    queryFn: ({ signal }) => listReportGroupsRequest(signal),
    retry: false,
  });
  const groups = getVisibleReportGroups(
    groupsQuery.data ?? [],
    userId,
    permissions,
    mode,
  );
  const values = applied ?? defaults;
  const groupAllowed = groups.some(
    (group) => String(group.id) === values.handlinggroup,
  );
  const showReport = mode === "dashboard" && groupAllowed;
  const report = useQuery({
    queryKey: ["reports", userId, values],
    queryFn: ({ signal }) => getReportRequest(values, signal),
    enabled: showReport,
    retry: false,
    placeholderData: (previous, query) =>
      query?.queryKey[1] === userId ? previous : undefined,
  });
  const download = useMutation({
    mutationKey: ["report-export", userId, mode],
    retry: false,
    mutationFn:
      mode === "dashboard" ? exportReportRequest : exportReportDataRequest,
    onSuccess: (blob, filters) => {
      const name =
        groups.find((group) => String(group.id) === filters.handlinggroup)
          ?.name ?? "Report";
      downloadFile(blob, getReportFilename(mode, name, filters));
      toast.success("Đã tạo tệp Excel.");
    },
    onSettled: () => {
      exporting.current = false;
    },
  });
  const exportFile = (filters: ReportFilters) => {
    if (
      exporting.current ||
      !groups.some((group) => String(group.id) === filters.handlinggroup)
    )
      return;
    exporting.current = true;
    download.mutate(filters);
  };
  const apply = (filters: ReportFilters) => {
    if (JSON.stringify(filters) === JSON.stringify(values))
      void report.refetch();
    else setApplied(filters);
  };
  if (groupsQuery.isPending)
    return <LoadingState message="Đang tải bộ phận xử lý..." />;
  if (groupsQuery.isError)
    return (
      <div className="space-y-3">
        <ErrorToast
          message={`Không tải được bộ phận xử lý: ${groupsQuery.error.message}`}
        />
        <Button variant="outline" onClick={() => void groupsQuery.refetch()}>
          Thử lại bộ phận xử lý
        </Button>
      </div>
    );
  if (groups.length === 0)
    return (
      <EmptyState
        title="Không có bộ phận xử lý phù hợp"
        description={
          mode === "export"
            ? "Bạn cần được phân quyền quản lý bộ phận để truy xuất dữ liệu."
            : "Chưa có bộ phận xử lý đang hoạt động."
        }
        className="my-auto"
      />
    );
  return (
    <div
      className={cn(
        "min-w-0 w-full space-y-4",
        !showReport && "max-w-4xl self-center sm:my-auto",
      )}
    >
      <ReportFiltersForm
        key={`${userId}-${mode}`}
        mode={mode}
        groups={groups}
        initialValues={values}
        loading={mode === "dashboard" && report.isFetching}
        exporting={download.isPending}
        onApply={apply}
        onExport={exportFile}
      />
      {download.isError && <ErrorToast message={download.error.message} />}
      {showReport && <ReportResults report={report} />}
    </div>
  );
}
