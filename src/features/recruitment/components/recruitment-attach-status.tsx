import { ErrorToast } from "@/components/error-toast";
import type { UseQueryResult } from "@tanstack/react-query";
import type { RecruitmentListData } from "../types";

export function RecruitmentAttachStatus({
  count,
  schedules,
  hasDate,
}: Readonly<{
  count: number;
  schedules: UseQueryResult<RecruitmentListData, Error>;
  hasDate: boolean;
}>) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">Đã chọn {count} ứng viên.</p>
      {schedules.isFetching && (
        <p role="status" className="text-muted-foreground">
          Đang tải lịch phỏng vấn...
        </p>
      )}
      {hasDate &&
        schedules.isSuccess &&
        !schedules.isFetching &&
        schedules.data.results.length === 0 && (
          <p role="status" className="rounded-lg border bg-muted/30 p-3">
            Không có lịch phỏng vấn trong ngày đã chọn. Vui lòng chọn ngày khác.
          </p>
        )}
      {schedules.isError && <ErrorToast message={schedules.error.message} />}
    </div>
  );
}
