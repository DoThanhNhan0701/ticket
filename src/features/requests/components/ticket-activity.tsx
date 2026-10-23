import { ErrorToast } from "@/components/error-toast";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/loading-state";
import { formatDataDateTime } from "@/components/data-management";
import { getTicketHistory } from "../api/request-detail-api";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
export { TicketDiscussion } from "./ticket-discussion";

export function TicketHistory({
  id,
  active,
}: Readonly<{ id: number; active: boolean }>) {
  const { userId } = useAuthContext();
  const history = useQuery({
    queryKey: ["ticket-history", id, userId],
    queryFn: ({ signal }) => getTicketHistory(id, signal),
    enabled: active,
    staleTime: 0,
  });
  return (
    <Card className="min-w-0 gap-4 p-4 sm:p-5">
      {history.isPending && active && (
        <LoadingState message="Đang tải lịch sử..." />
      )}
      {history.isError && <ErrorToast message={history.error.message} />}
      {history.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Chưa có lịch sử thay đổi.
        </p>
      )}
      <ol className="space-y-3">
        {history.data?.map((entry, index) => {
          const timestamp = formatDataDateTime(entry.created);
          return (
            <li
              key={entry.id ?? index}
              className="space-y-2 rounded-lg border border-border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <strong className="min-w-0 wrap-anywhere">
                  {entry.username}
                </strong>
                <time className="text-xs text-muted-foreground">
                  {timestamp && `- cập nhật lúc ${timestamp}`}
                </time>
              </div>
              <p className="whitespace-pre-wrap wrap-anywhere">
                {[entry.system_log, entry.user_log, entry.comment_content]
                  .filter(Boolean)
                  .join("\n")}
              </p>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
