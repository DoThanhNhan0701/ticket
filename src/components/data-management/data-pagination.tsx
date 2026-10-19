import { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { DataPaginationProps } from "./types";

function PageIndicator({
  page,
  totalPages,
}: Readonly<{
  page: number;
  totalPages: number;
}>) {
  return (
    <>
      <span className="hidden min-w-24 px-2 text-center text-sm whitespace-nowrap tabular-nums sm:inline">
        Trang {page} / {totalPages}
      </span>
      <span className="min-w-11 px-1 text-center text-xs tabular-nums sm:hidden">
        {page}/{totalPages}
      </span>
    </>
  );
}

export function DataPagination({
  count,
  page,
  pageSize,
  pageSizes,
  itemLabel = "bản ghi",
  disabled = false,
  onPage,
  onPageSize,
}: Readonly<DataPaginationProps>) {
  const sizeId = useId();
  if (count === 0) return null;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const first = count ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, count);
  return (
    <div className="flex min-w-0 shrink-0 flex-nowrap items-center justify-between gap-2 border-t border-border p-2 sm:gap-4 sm:p-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground sm:gap-3 sm:text-sm">
        <p
          aria-live="polite"
          title={`Hiển thị ${first}–${last} trên ${count} ${itemLabel}`}
          className="min-w-0 truncate tabular-nums"
        >
          <span aria-hidden="true" className="sm:hidden">
            {first}–{last} / {count}
          </span>
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Hiển thị {first}–{last} trên {count} {itemLabel}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Label htmlFor={sizeId} className="sr-only">
            Số {itemLabel} mỗi trang
          </Label>
          <Select
            value={pageSize}
            disabled={disabled}
            items={pageSizes.map((size) => ({
              value: size,
              label: `${size} / trang`,
            }))}
            onValueChange={(value) => {
              if (value !== null) onPageSize(value);
            }}
          >
            <SelectTrigger
              id={sizeId}
              title={`${pageSize} / trang`}
              className="min-w-16 gap-1 px-2 text-xs min-[400px]:px-3 min-[400px]:text-sm sm:px-3 sm:text-sm"
            >
              <SelectValue>
                <span>
                  {pageSize}
                  <span className="hidden min-[400px]:inline"> / trang</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {pageSizes.map((size) => (
                <SelectItem key={size} value={size}>
                  {size} / trang
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <nav
        aria-label={`Phân trang ${itemLabel}`}
        className="flex shrink-0 flex-nowrap items-center sm:gap-3"
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 sm:size-9 sm:pointer-coarse:size-11"
          aria-label="Trang trước"
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <PageIndicator page={page} totalPages={totalPages} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 sm:size-9 sm:pointer-coarse:size-11"
          aria-label="Trang sau"
          disabled={disabled || page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </nav>
    </div>
  );
}
