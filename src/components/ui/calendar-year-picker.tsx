import { useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { type DropdownProps, useDayPicker } from "react-day-picker";

import { SearchInput } from "@/components/search-input";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function CalendarYearPicker({
  options = [],
  value,
  disabled,
  "aria-label": label = "Choose the Year",
}: DropdownProps) {
  const { goToMonth, months } = useDayPicker();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const visibleYears = options.filter((option) =>
    option.label.includes(search.trim()),
  );

  function selectYear(year: number) {
    goToMonth(new Date(year, months[0].date.getMonth(), 1));
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={label}
          className="h-11 gap-2 px-3 sm:h-9 sm:pointer-coarse:h-11"
        >
          {options.find((option) => option.value === Number(value))?.label ??
            value}
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        collisionPadding={8}
        className="w-68 max-w-[calc(100vw-2rem)] p-2"
        aria-label="Choose year"
        onOpenAutoFocus={() => {
          const list = listRef.current;
          const selected = selectedRef.current;
          if (list && selected) {
            list.scrollTop =
              selected.offsetTop -
              list.clientHeight / 2 +
              selected.clientHeight / 2;
          }
        }}
      >
        <SearchInput
          label="Search year"
          placeholder="Enter year..."
          inputMode="numeric"
          maxLength={4}
          value={search}
          onValueChange={setSearch}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (visibleYears.length === 1 && !visibleYears[0].disabled) {
                selectYear(visibleYears[0].value);
              }
            }
          }}
          wrapperClassName="mb-2"
        />
        <div
          ref={listRef}
          className="relative max-h-60 overflow-y-auto overscroll-contain"
        >
          <div
            role="group"
            className="grid grid-cols-4 gap-1"
            aria-label="Years"
          >
            {visibleYears.map((option) => (
              <Button
                key={option.value}
                ref={option.value === Number(value) ? selectedRef : undefined}
                type="button"
                variant={option.value === Number(value) ? "default" : "ghost"}
                disabled={option.disabled}
                aria-pressed={option.value === Number(value)}
                className="h-11 px-1 tabular-nums"
                onClick={() => selectYear(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {visibleYears.length === 0 && (
            <p
              role="status"
              className="py-4 text-center text-sm text-muted-foreground"
            >
              No matching year.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
