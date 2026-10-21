import { useEffect, useState, type ComponentProps } from "react";
import { Clock3 } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import { cn } from "@/lib/utils";

type TimePickerProps = Omit<
  ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
};

function parseTime(value: string) {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value);
  if (!match || Number(match[1]) > 23) return;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}
const twoDigits = (value: number) => String(value).padStart(2, "0");

export function TimePicker({
  label,
  value,
  onValueChange,
  disabled,
  className,
  onBlur,
  onKeyDown,
  ...props
}: Readonly<TimePickerProps>) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const selected = parseTime(value);
  const changePart = (part: "hour" | "minute", next: number) => {
    const time = { hour: 0, minute: 0, ...selected, [part]: next };
    onValueChange(`${twoDigits(time.hour)}:${twoDigits(time.minute)}`);
  };
  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative min-w-0">
          <Input
            {...props}
            type="text"
            placeholder="HH:mm"
            autoComplete="off"
            spellCheck={false}
            value={value}
            disabled={disabled}
            className={cn("pl-11 tabular-nums", className)}
            onChange={(event) => onValueChange(event.target.value)}
            onBlur={(event) => {
              const time = parseTime(value.trim());
              if (time)
                onValueChange(
                  `${twoDigits(time.hour)}:${twoDigits(time.minute)}`,
                );
              onBlur?.(event);
            }}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              if (!event.defaultPrevented && event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
              }
            }}
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={`Chọn ${label.toLowerCase()}`}
              title={`Chọn ${label.toLowerCase()}`}
              className="absolute inset-y-0 left-0 h-auto w-11 rounded-r-none text-muted-foreground"
            >
              <Clock3 className="size-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-56 max-w-[calc(100vw-2rem)] p-0"
        aria-label={`Chọn ${label.toLowerCase()}`}
      >
        <div className="grid grid-cols-2 divide-x">
          <TimeOptions
            label="Giờ"
            count={24}
            selected={selected?.hour ?? 0}
            onSelect={(hour) => changePart("hour", hour)}
          />
          <TimeOptions
            label="Phút"
            count={60}
            selected={selected?.minute ?? 0}
            onSelect={(minute) => changePart("minute", minute)}
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!value}
            onClick={() => {
              onValueChange("");
              setOpen(false);
            }}
          >
            Xóa giờ
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Xong
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimeOptions({
  label,
  count,
  selected,
  onSelect,
}: Readonly<{
  label: string;
  count: number;
  selected: number;
  onSelect: (value: number) => void;
}>) {
  return (
    <div className="min-w-0">
      <p className="border-b py-2 text-center text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <div
        role="group"
        aria-label={label}
        className="h-56 space-y-1 overflow-y-auto overscroll-contain p-2"
      >
        {Array.from({ length: count }, (_, value) => (
          <Button
            key={value}
            type="button"
            variant={selected === value ? "default" : "ghost"}
            size="sm"
            className="w-full tabular-nums"
            aria-label={`${label} ${twoDigits(value)}`}
            aria-pressed={selected === value}
            tabIndex={selected === value ? 0 : -1}
            ref={(element) => {
              if (selected === value)
                element?.scrollIntoView?.({ block: "nearest" });
            }}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === "ArrowDown") next = (selected + 1) % count;
              else if (event.key === "ArrowUp")
                next = (selected + count - 1) % count;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = count - 1;
              else return;
              event.preventDefault();
              onSelect(next);
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>("button")
                [next]?.focus();
            }}
            onClick={() => onSelect(value)}
          >
            {twoDigits(value)}
          </Button>
        ))}
      </div>
    </div>
  );
}
