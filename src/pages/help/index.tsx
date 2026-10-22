import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/loading-state";
import { ErrorAlert } from "@/components/error-alert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  loadUserGuide,
  USER_GUIDE_FILENAME,
  USER_GUIDE_URL,
} from "@/features/help/api/user-guide-api";
import { GuideReader } from "@/features/help/components/guide-reader";

export function UserGuidePage() {
  const document = useQuery({
    queryKey: ["user-guide", USER_GUIDE_URL],
    queryFn: ({ signal }) => loadUserGuide(signal),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const metadata = [
    document.data?.version && `Phiên bản ${document.data.version}`,
    document.data?.updatedAt && `Cập nhật ${document.data.updatedAt}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-3">
      <PageHeader
        title="Hướng dẫn sử dụng"
        description={metadata || "Tra cứu hướng dẫn sử dụng Rainscales Ticket"}
        icon={BookOpen}
        actions={
          <a
            href={USER_GUIDE_URL}
            download={USER_GUIDE_FILENAME}
            title="Tải tài liệu Word"
            aria-label="Tải tài liệu Word"
            className={buttonVariants({
              variant: "outline",
              className: "max-sm:size-11 max-sm:px-0",
            })}
          >
            <Download className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Tải tài liệu Word</span>
          </a>
        }
      />
      {document.isPending && (
        <LoadingState message="Đang tải tài liệu hướng dẫn…" />
      )}
      {document.isError && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5">
          <ErrorAlert message="Không đọc được tài liệu hướng dẫn. Vui lòng thử lại hoặc tải bản Word." />
          <Button variant="outline" onClick={() => void document.refetch()}>
            Thử lại
          </Button>
        </div>
      )}
      {document.data && <GuideReader guide={document.data} />}
    </div>
  );
}
