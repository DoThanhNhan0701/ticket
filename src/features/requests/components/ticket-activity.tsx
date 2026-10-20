import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/loading-state";
import { ErrorAlert } from "@/components/error-alert";
import { formatDataDate } from "@/components/data-management";
import { getTicketHistory } from "../api/request-detail-api";
export { TicketDiscussion } from "./ticket-discussion";

export function TicketHistory({
  id,
  active,
}: Readonly<{ id: number; active: boolean }>) {
  const history = useQuery({
    queryKey: ["ticket-history", id],
    queryFn: ({ signal }) => getTicketHistory(id, signal),
    enabled: active,
  });
  return (
    <Card className="min-w-0 gap-4 p-4 sm:p-5">
      {history.isPending && active && (
        <LoadingState message="Đang tải lịch sử..." />
      )}
      {history.isError && (
        <>
          <ErrorAlert message={history.error.message} />
          <Button variant="outline" onClick={() => void history.refetch()}>
            Thử lại
          </Button>
        </>
      )}
      {history.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Chưa có lịch sử thay đổi.
        </p>
      )}
      <ol className="space-y-3">
        {history.data?.map((entry, index) => (
          <li
            key={entry.id ?? index}
            className="space-y-2 rounded-lg border border-border p-3 text-sm"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <strong>{entry.username}</strong>
              <time className="text-xs text-muted-foreground">
                {formatDataDate(entry.created)}
              </time>
            </div>
            <p className="whitespace-pre-wrap wrap-anywhere">
              {[entry.system_log, entry.user_log, entry.comment_content]
                .filter(Boolean)
                .join("\n")}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
