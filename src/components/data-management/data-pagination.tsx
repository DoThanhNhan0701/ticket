import { t, useLocale } from "@/i18n";
import { useId, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  disabled,
  onPage,
}: Readonly<{
  page: number;
  totalPages: number;
  disabled: boolean;
  onPage: (page: number) => void;
}>) {
  useLocale();
  const [draft, setDraft] = useState(String(page));
  return (
    <div className="flex min-w-0 items-center gap-1.5 px-1 text-xs tabular-nums sm:gap-2 sm:text-sm">
      <span className="hidden sm:inline">{t("common", "Trang")}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        max={totalPages}
        step={1}
        required
        aria-label={t("common", "Đến trang")}
        title={t("common", "Nhập trang từ 1 đến {0}, nhấn Enter để chuyển", [
          totalPages,
        ])}
        value={draft}
        disabled={disabled}
        className="h-11 w-12 px-1 text-center text-xs [appearance:textfield] sm:h-9 sm:w-14 sm:text-sm sm:pointer-coarse:h-11 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => setDraft(String(page))}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          event.stopPropagation();
          if (disabled) return;
          const entered = Number(draft);
          if (!draft.trim() || !Number.isSafeInteger(entered)) {
            setDraft(String(page));
            return;
          }
          const next = Math.max(1, Math.min(totalPages, entered));
          setDraft(String(next));
          if (next !== page) onPage(next);
        }}
      />
      <span className="whitespace-nowrap">/ {totalPages}</span>
    </div>
  );
}

export function DataPagination({
  count,
  page,
  pageSize,
  pageSizes,
  itemLabel = t("common", "bản ghi"),
  disabled = false,
  onPage,
  onPageSize,
}: Readonly<DataPaginationProps>) {
  useLocale();
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
          title={t("common", "Hiển thị {0}–{1} trên {2} {3}", [
            first,
            last,
            count,
            itemLabel,
          ])}
          className="min-w-0 truncate tabular-nums"
        >
          <span aria-hidden="true" className="sm:hidden">
            {first}–{last} / {count}
          </span>
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            {" "}
            {t("common", "Hiển thị")} {first}–{last} {t("common", "trên")}{" "}
            {count} {itemLabel}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Label htmlFor={sizeId} className="sr-only">
            {t("common", "Số")} {itemLabel} {t("common", "mỗi trang")}
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
        aria-label={t("common", "Phân trang {0}", [itemLabel])}
        className="flex shrink-0 flex-nowrap items-center sm:gap-3"
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 sm:size-9 sm:pointer-coarse:size-11"
          aria-label={t("common", "Trang trước")}
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <PageIndicator
          key={`${page}-${totalPages}`}
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
          aria-label={t("common", "Trang sau")}
          disabled={disabled || page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </nav>
    </div>
  );
}
