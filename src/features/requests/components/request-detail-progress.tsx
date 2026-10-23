import { memo, useEffect, useMemo, useState, type RefObject } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { ArrowRight, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CreateRequestValues } from "../schemas/create-request-schema";
import { detailFields, fieldOptions } from "../utils/request-detail-data";

export const RequestDetailProgress = memo(function RequestDetailProgress({
  form,
  fields,
  disabled,
  scrollContainer,
}: Readonly<{
  form: UseFormReturn<CreateRequestValues>;
  fields: ReturnType<typeof detailFields>;
  disabled: boolean;
  scrollContainer: RefObject<HTMLDivElement | null>;
}>) {
  const [hasOverflow, setHasOverflow] = useState(false);
  useEffect(() => {
    const container = scrollContainer.current;
    if (!container) return;
    const measure = () =>
      setHasOverflow(container.scrollWidth > container.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (container.firstElementChild)
      observer.observe(container.firstElementChild);
    return () => observer.disconnect();
  }, [scrollContainer]);
  const rows = useWatch({ control: form.control, name: "rows" });
  const requiredInputs = useMemo(
    () =>
      fields
        .filter((field) => field.required)
        .flatMap((field) => {
          const parts =
            field.type === "range-date-text" && !fieldOptions(field).length
              ? [
                  {
                    key: `${field.fieldKey}_start`,
                    suffix: "-start",
                    label: " – Từ ngày",
                  },
                  {
                    key: `${field.fieldKey}_end`,
                    suffix: "-end",
                    label: " – Đến ngày",
                  },
                ]
              : [{ key: field.fieldKey, suffix: "", label: "" }];
          return parts.map((part) => ({
            key: part.key,
            id: `${field.fieldKey}${part.suffix}`,
            label: `${field.title}${part.label}`,
          }));
        }),
    [fields],
  );
  const { total, missing, next } = useMemo(() => {
    let missing = 0;
    let next: { id: string; label: string } | undefined;
    for (const [index, row] of (rows ?? []).entries()) {
      for (const input of requiredInputs) {
        if (row.values?.[input.key]?.trim()) continue;
        missing++;
        next ??= {
          id: `detail-${index}-${input.id}`,
          label: `Dòng ${index + 1} · ${input.label}`,
        };
      }
    }
    return {
      total: (rows?.length ?? 0) * requiredInputs.length,
      missing,
      next,
    };
  }, [rows, requiredInputs]);
  if (!hasOverflow || !next) return null;

  return (
    <div className="fixed top-[calc(4.75rem+env(safe-area-inset-top))] right-3 z-30 flex w-[calc(100%-1.5rem)] max-w-md items-center gap-2 rounded-xl border border-warning-border bg-warning-soft px-3 py-2.5 text-warning shadow-lg sm:right-6 sm:gap-3">
      <ListChecks className="size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-xs" aria-live="polite">
        <p
          className="truncate font-medium"
          title={`Đã nhập ${total - missing}/${total} ô bắt buộc · Còn ${missing} ô chưa nhập`}
        >
          Đã nhập {total - missing}/{total} ô bắt buộc
          {` · Còn ${missing} ô chưa nhập`}
        </p>
        <p className="mt-0.5 truncate" title={next.label}>
          Tiếp theo: {next.label}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label="Đến ô chưa nhập"
        title="Đến ô chưa nhập"
        className="size-9 shrink-0 px-0 sm:h-8 sm:w-auto sm:px-3"
        disabled={disabled}
        onClick={() => {
          const input = document.getElementById(next.id);
          input?.focus({ preventScroll: true });
          input?.scrollIntoView({ block: "nearest", inline: "nearest" });
        }}
      >
        <span className="hidden sm:inline">Đến ô chưa nhập</span>
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
});
