import { useId, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { DataPaginationProps } from "./types";

function PageJump({
  page,
  totalPages,
  disabled,
  onPage,
}: Readonly<{
  page: number;
  totalPages: number;
  disabled: boolean;
  onPage: (page: number) => void;
}>) {
  const [value, setValue] = useState(String(page));
  const pageId = useId();
  return (
    <form
      className="flex shrink-0 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const next = Number(value);
        if (Number.isSafeInteger(next) && next >= 1 && next <= totalPages)
          onPage(next);
      }}
    >
      <Label htmlFor={pageId} className="sr-only">
        Đến trang
      </Label>
      <Input
        id={pageId}
        type="number"
        min={1}
        max={totalPages}
        required
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        className="w-20"
      />
      <Button type="submit" variant="outline" disabled={disabled}>
        Đến trang
      </Button>
    </form>
  );
}

function PageIndicator({
  page,
  totalPages,
  disabled,
  onPage,
}: Readonly<{
  page: number;
  totalPages: number;
  disabled: boolean;
  onPage: (page: number) => void;
}>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="hidden min-w-24 px-2 text-center text-sm whitespace-nowrap tabular-nums sm:inline">
        Trang {page} / {totalPages}
      </span>
      {totalPages === 1 ? (
        <span className="min-w-11 px-1 text-center text-xs tabular-nums sm:hidden">
          {page}/{totalPages}
        </span>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              aria-label="Chọn trang"
              title="Đến trang"
              className="h-11 min-w-11 gap-0.5 px-1 text-xs tabular-nums sm:hidden"
            >
              <span>
                {page}/{totalPages}
              </span>
              <ChevronDown
                className="size-2.5 text-muted-foreground"
                aria-hidden="true"
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            side="top"
            collisionPadding={12}
            className="w-auto max-w-[calc(100vw-1.5rem)] p-3"
            aria-label="Chọn trang"
          >
            <p className="mb-3 text-sm font-medium">Đến trang</p>
            <PageJump
              key={`${page}:${totalPages}`}
              page={page}
              totalPages={totalPages}
              disabled={disabled}
              onPage={(next) => {
                onPage(next);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      )}
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
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border p-2 sm:flex-wrap sm:gap-4 sm:p-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground sm:flex-none sm:gap-3 sm:text-sm">
        <p
          aria-live="polite"
          title={`Hiển thị ${first}–${last} trên ${count} ${itemLabel}`}
          className="min-w-0 flex-1 truncate tabular-nums sm:flex-none"
        >
          <span aria-hidden="true" className="sm:hidden">
            {first}–{last} / {count}
          </span>
          <span className="sr-only sm:not-sr-only">
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
        className="flex shrink-0 items-center sm:flex-wrap sm:gap-3"
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
        <PageIndicator
          page={page}
          totalPages={totalPages}
          disabled={disabled}
          onPage={onPage}
        />
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
        {totalPages > 1 && (
          <div className="hidden sm:block">
            <PageJump
              key={`${page}:${totalPages}`}
              page={page}
              totalPages={totalPages}
              disabled={disabled}
              onPage={onPage}
            />
          </div>
        )}
      </nav>
    </div>
  );
}
