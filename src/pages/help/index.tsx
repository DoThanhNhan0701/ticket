import { t, useLocale } from "@/i18n";
import { ErrorToast } from "@/components/error-toast";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/loading-state";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  loadUserGuide,
  USER_GUIDE_FILENAME,
  USER_GUIDE_URL,
  ENGLISH_GUIDE_FILENAME,
} from "@/features/help/api/user-guide-api";
import { GuideReader } from "@/features/help/components/guide-reader";

export function UserGuidePage() {
  const locale = useLocale();
  const filename =
    locale === "vi" ? USER_GUIDE_FILENAME : ENGLISH_GUIDE_FILENAME;
  const document = useQuery({
    queryKey: ["user-guide", USER_GUIDE_URL, locale],
    queryFn: ({ signal }) => loadUserGuide(signal, locale),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const metadata = [
    document.data?.version &&
      t("help", "Phiên bản {0}", [document.data.version]),
    document.data?.updatedAt &&
      t("help", "Cập nhật {0}", [document.data.updatedAt]),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-2 sm:gap-3">
      <PageHeader
        title={t("help", "Hướng dẫn sử dụng")}
        description={
          metadata || t("help", "Tra cứu hướng dẫn sử dụng Rainscales Ticket")
        }
        icon={BookOpen}
        actions={
          <a
            href={`/docs/${filename}`}
            download={filename}
            title={t("help", "Tải tài liệu Word")}
            aria-label={t("help", "Tải tài liệu Word")}
            className={buttonVariants({
              variant: "outline",
              className: "max-sm:size-11 max-sm:px-0",
            })}
          >
            <Download className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">
              {t("help", "Tải tài liệu Word")}
            </span>
          </a>
        }
      />
      {document.isPending && (
        <LoadingState message={t("help", "Đang tải tài liệu hướng dẫn…")} />
      )}
      {document.isError && (
        <ErrorToast
          message={t(
            "help",
            "Không đọc được tài liệu hướng dẫn. Vui lòng thử lại hoặc tải bản Word.",
          )}
        />
      )}
      {document.data && <GuideReader guide={document.data} />}
    </div>
  );
}
