import { useState, type Ref } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlClassName } from "./control-styles";
import { Input } from "./input";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export function SearchableSelect({
  id,
  label,
  options,
  value,
  onValueChange,
  onBlur,
  ref,
  placeholder,
  noDataText = "Không có lựa chọn",
  disabled = false,
  invalid = false,
  describedBy,
}: Readonly<{
  id: string;
  label: string;
  options: readonly SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
  placeholder?: string;
  noDataText?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}>) {
  const [search, setSearch] = useState("");
  const { contains } = Combobox.useFilter({ sensitivity: "base" });
  const selected = value
    ? (options.find((option) => option.value === value) ?? null)
    : null;
  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={(option) => onValueChange(option?.value ?? "")}
      isItemEqualToValue={(option, current) => option.value === current.value}
      inputValue={search}
      onInputValueChange={setSearch}
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
      filter={(option, query) => contains(option.label, query.trim())}
      disabled={disabled}
      autoHighlight
    >
      <Combobox.Trigger
        id={id}
        ref={ref}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        title={selected?.label}
        onBlur={onBlur}
        className={cn(
          controlClassName,
          "flex items-center justify-between gap-2 text-left data-placeholder:text-muted-foreground",
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <Combobox.Value placeholder={placeholder} />
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="isolate z-50"
        >
          <Combobox.Popup
            aria-label={`Chọn ${label.toLowerCase()}`}
            className="flex max-h-(--available-height) w-(--anchor-width) min-w-0 flex-col rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md outline-none"
          >
            <div className="relative mb-2 shrink-0">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Combobox.Input
                render={<Input />}
                aria-label={`Tìm ${label.toLowerCase()}`}
                placeholder={`Tìm ${label.toLowerCase()}...`}
                className="pl-9"
              />
            </div>
            <Combobox.Empty className="px-2 py-3 text-center text-sm text-muted-foreground empty:hidden">
              {options.length === 0 ? noDataText : "Không tìm thấy kết quả."}
            </Combobox.Empty>
            <Combobox.List className="min-h-0 max-h-60 overflow-y-auto overscroll-contain">
              {(option: SearchableSelectOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span
                    className="min-w-0 flex-1 truncate"
                    title={option.label}
                  >
                    {option.label}
                  </span>
                  <Combobox.ItemIndicator>
                    <Check className="size-4" aria-hidden="true" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
