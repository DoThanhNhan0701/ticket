import type { ReactNode } from "react";
import { RotateCcw, Search } from "lucide-react";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";

export function RecruitmentFilterActions({
  busy,
  onReset,
  children,
}: Readonly<{ busy: boolean; onReset: () => void; children?: ReactNode }>) {
  return (
    <div className="col-span-full flex min-w-0 flex-wrap items-center gap-2 xl:flex-1">
      <AsyncButton
        type="submit"
        loading={busy}
        icon={<Search className="size-4" aria-hidden="true" />}
      >
        Tìm kiếm
      </AsyncButton>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 sm:size-10 sm:pointer-coarse:size-11"
        disabled={busy}
        onClick={onReset}
        aria-label="Xóa lọc tuyển dụng"
        title="Xóa lọc"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
      </Button>
      {children}
    </div>
  );
}
