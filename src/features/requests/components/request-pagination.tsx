import { useState } from "react";
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
import { requestPageSizes, type RequestListParams } from "../types";

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
      <Label htmlFor="request-page" className="sr-only">
        Đến trang
      </Label>
      <Input
        id="request-page"
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

export function RequestPagination({
  count,
  params,
  disabled,
  onPage,
  onPageSize,
}: Readonly<{
  count: number;
  params: RequestListParams;
  disabled: boolean;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}>) {
  const totalPages = Math.max(1, Math.ceil(count / params.page_size));
  const first = count ? (params.page - 1) * params.page_size + 1 : 0;
  const last = Math.min(params.page * params.page_size, count);
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-border p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <p aria-live="polite">
          Hiển thị {first}–{last} trên {count} yêu cầu
        </p>
        <div className="flex items-center gap-2">
          <Label htmlFor="request-page-size" className="sr-only">
            Số yêu cầu mỗi trang
          </Label>
          <Select
            value={params.page_size}
            items={requestPageSizes.map((size) => ({
              value: size,
              label: `${size} / trang`,
            }))}
            onValueChange={(value) => {
              if (value !== null) onPageSize(value);
            }}
          >
            <SelectTrigger id="request-page-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {requestPageSizes.map((size) => (
                <SelectItem key={size} value={size}>
                  {size} / trang
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <nav
        aria-label="Phân trang yêu cầu"
        className="flex flex-wrap items-center gap-2"
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Trang trước"
          disabled={disabled || params.page <= 1}
          onClick={() => onPage(params.page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <span className="px-1 text-sm tabular-nums">
          Trang {params.page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Trang sau"
          disabled={disabled || params.page >= totalPages}
          onClick={() => onPage(params.page + 1)}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
        <PageJump
          key={`${params.page}:${totalPages}`}
          page={params.page}
          totalPages={totalPages}
          disabled={disabled}
          onPage={onPage}
        />
      </nav>
    </div>
  );
}
