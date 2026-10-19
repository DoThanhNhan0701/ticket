import { useId, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      className="flex items-center gap-2"
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
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-border p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <p aria-live="polite">
          Hiển thị {first}–{last} trên {count} {itemLabel}
        </p>
        <div className="flex items-center gap-2">
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
            <SelectTrigger id={sizeId}>
              <SelectValue />
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
        className="flex flex-wrap items-center gap-2"
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Trang trước"
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <span className="px-1 text-sm tabular-nums">
          Trang {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Trang sau"
          disabled={disabled || page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
        <PageJump
          key={`${page}:${totalPages}`}
          page={page}
          totalPages={totalPages}
          disabled={disabled}
          onPage={onPage}
        />
      </nav>
    </div>
  );
}
