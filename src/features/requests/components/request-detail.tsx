import { APP_ROUTES } from "@/constants/routes";
import { useRef, type KeyboardEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TruncatedText } from "@/components/truncated-text";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { ApiError } from "@/lib/api/api-error";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { getRequestDetail, validTicketId } from "../api/request-detail-api";
import type { RequestDetailData } from "../schemas/request-detail-schema";
import { TicketTemplate } from "./ticket-template";
import { TicketGeneral } from "./ticket-general";
import { TicketActions } from "./ticket-actions";
import { TicketCloneButton } from "./ticket-clone-button";
import { TicketDiscussion, TicketHistory } from "./ticket-activity";

const tabs = ["Thông tin chung", "Chi tiết yêu cầu", "Trao đổi", "Lịch sử"];
const tabKeys = ["general", "details", "discussion", "history"];
function TicketStatusSummary({
  ticket,
}: Readonly<{ ticket: RequestDetailData }>) {
  if (!ticket.ticket_status_name) return null;
  const color = /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(ticket.color)
    ? ticket.color
    : "var(--primary)";
  return (
    <div
      role="group"
      aria-label="Trạng thái yêu cầu"
      className="flex h-10 min-w-0 max-w-[40vw] items-center justify-center rounded-lg border px-3 sm:max-w-xs"
      style={{
        borderColor: `color-mix(in srgb, ${color} 50%, var(--card))`,
        backgroundColor: `color-mix(in srgb, ${color} 12%, var(--card))`,
      }}
    >
      <span
        className="truncate text-xs font-medium sm:text-sm"
        title={ticket.ticket_status_name}
      >
        {ticket.ticket_status_name}
      </span>
    </div>
  );
}

function DetailTabs({
  ticket,
  onSaved,
}: Readonly<{
  ticket: RequestDetailData;
  onSaved: () => Promise<unknown>;
}>) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const active = Math.max(0, tabKeys.indexOf(params.get("tab") ?? "general"));
  const commentCount = ticket.comments.reduce(
    (total, comment) => total + 1 + comment.item_comment.length,
    0,
  );
  const setActive = (index: number) => {
    const next = new URLSearchParams(location.search);
    next.set("tab", tabKeys[index]);
    void navigate(
      { search: `?${next.toString()}`, hash: location.hash },
      { replace: true, preventScrollReset: true },
    );
  };
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const switchWithKeyboard = (event: KeyboardEvent, index: number) => {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        next = (index + tabs.length - 1) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
    tabRefs.current[next]?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
  };
  return (
    <>
      <div className="min-w-0 shrink-0 rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 font-semibold">
            <TruncatedText text={ticket.ticket_code || `#${ticket.id}`} />
          </span>
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
            <TicketCloneButton ticket={ticket} />
            <TicketActions ticket={ticket} onSaved={onSaved} />
          </div>
        </div>
        <p className="mt-2 min-w-0 text-sm whitespace-pre-wrap wrap-anywhere">
          {ticket.title}
        </p>
      </div>
      <div
        role="tablist"
        aria-label="Các bước yêu cầu"
        className="flex min-w-0 shrink-0 gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1"
      >
        {tabs.map((label, index) => (
          <button
            key={label}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`ticket-tab-${index}`}
            aria-selected={active === index}
            aria-controls={`ticket-panel-${index}`}
            tabIndex={active === index ? 0 : -1}
            onKeyDown={(event) => switchWithKeyboard(event, index)}
            onClick={() => setActive(index)}
            className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11 ${active === index ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {label}
            {tabKeys[index] === "discussion" && (
              <span
                aria-label={`${commentCount} bình luận`}
                title="Tổng số bình luận và câu trả lời"
                className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums ${active === index ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {commentCount}
              </span>
            )}
          </button>
        ))}
      </div>
      {tabs.map((label, index) => (
        <div
          key={label}
          role="tabpanel"
          id={`ticket-panel-${index}`}
          aria-labelledby={`ticket-tab-${index}`}
          hidden={active !== index}
          tabIndex={0}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pb-3 -outline-offset-2"
        >
          {index === 0 && <TicketGeneral ticket={ticket} onSaved={onSaved} />}
          {index === 1 && <TicketTemplate ticket={ticket} onSaved={onSaved} />}
          {index === 2 && (
            <TicketDiscussion ticket={ticket} onSaved={onSaved} />
          )}
          {index === 3 && (
            <TicketHistory id={ticket.id} active={active === 3} />
          )}
        </div>
      ))}
    </>
  );
}
export function RequestDetail() {
  const { ticketID = "" } = useParams();
  const { userId } = useAuthContext();
  const navigate = useNavigate();
  const client = useQueryClient();
  const goBack = () => {
    const index: unknown = window.history.state?.idx;
    if (typeof index === "number" && index > 0) void navigate(-1);
    else void navigate(APP_ROUTES.requests.list, { replace: true });
  };
  const valid = validTicketId(ticketID);
  const query = useQuery({
    queryKey: ["request-detail", userId, ticketID],
    queryFn: ({ signal }) => getRequestDetail(ticketID, signal),
    enabled: valid,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({
        queryKey: ["ticket-history", Number(ticketID)],
      }),
      client.invalidateQueries({ queryKey: ["requests"] }),
      client.invalidateQueries({ queryKey: ["reports"] }),
    ]);
    return query.refetch({ throwOnError: true });
  };
  const error = query.error;
  let message = error?.message;
  if (error instanceof ApiError && error.status === 404)
    message = "Không tìm thấy yêu cầu.";
  if (error instanceof ApiError && error.status === 403)
    message = "Bạn không có quyền xem yêu cầu này.";
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-3 overflow-hidden">
      <PageHeader
        title="Chi tiết yêu cầu"
        description="Xem nội dung và tiến độ xử lý yêu cầu."
        icon={FileText}
        onBack={goBack}
        backLabel="Quay lại"
        actions={
          <>
            {query.data && !query.isError && (
              <TicketStatusSummary ticket={query.data} />
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10"
              aria-label="Tải lại yêu cầu"
              title="Tải lại yêu cầu"
              disabled={!valid || query.isFetching}
              onClick={() => void refresh().catch(() => undefined)}
            >
              <RefreshCw
                className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </>
        }
      />
      {!valid && <ErrorAlert message="Mã yêu cầu không hợp lệ." />}
      {valid && query.isPending && (
        <LoadingState message="Đang tải chi tiết yêu cầu..." />
      )}
      {query.isError && (
        <ErrorAlert message={message ?? "Không tải được yêu cầu."} />
      )}
      {query.data && !query.isError && (
        <DetailTabs key={ticketID} ticket={query.data} onSaved={refresh} />
      )}
    </div>
  );
}
