import { t, useLocale } from "@/i18n";
import type { ReactNode } from "react";
import { RotateCcw, Search } from "lucide-react";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";

export function RecruitmentFilterActions({
  busy,
  onReset,
  onCancel,
  children,
}: Readonly<{
  busy: boolean;
  onReset: () => void;
  onCancel?: () => void;
  children?: ReactNode;
}>) {
  useLocale();
  return (
    <div className="col-span-full grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center xl:flex-1">
      <AsyncButton
        title={t("recruitment", "Tìm kiếm")}
        type="submit"
        loading={busy}
        icon={<Search className="size-4" aria-hidden="true" />}
      >
        {t("recruitment", "Tìm kiếm")}
      </AsyncButton>
      {onCancel ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          {t("recruitment", "Hủy")}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 sm:size-10 sm:pointer-coarse:size-11"
          disabled={busy}
          onClick={onReset}
          aria-label={t("recruitment", "Xóa lọc tuyển dụng")}
          title={t("recruitment", "Xóa lọc")}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
        </Button>
      )}
      {children}
    </div>
  );
}
