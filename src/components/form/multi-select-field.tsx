import { useState, type ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Check, ChevronDown, X } from "lucide-react";
import { FormFieldShell } from "./form-field-shell";
import { controlClassName } from "@/components/ui/control-styles";
import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useElementWidth } from "@/hooks/use-element-width";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  id: string;
  label: string;
  options: MultiSelectOption[];
  placeholder?: string;
  noDataText?: string;
  required?: boolean;
  className?: string;
  labelAddon?: ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  maxBadgeCount?: number;
  valueFormat?: "array" | "csv";
}

type MultiSelectInputProps = Omit<
  MultiSelectFieldProps<FieldValues>,
  "control" | "name" | "required" | "className" | "labelAddon" | "valueFormat"
> & {
  value: unknown;
  onChange: (value: string[]) => void;
  onBlur: () => void;
  invalid: boolean;
};

function getSelectedValues(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" && value ? [value] : [];
}

function SelectedBadges({
  options,
  maxBadgeCount,
  disabled,
  onRemove,
}: Readonly<{
  options: MultiSelectOption[];
  maxBadgeCount?: number;
  disabled: boolean;
  onRemove: (value: string) => void;
}>) {
  const { ref, width } = useElementWidth();
  const capacity =
    width >= options.length * 64
      ? options.length
      : Math.max(0, Math.floor((width - 32) / 64));
  const visibleBadges = options.slice(
    0,
    Math.min(maxBadgeCount ?? options.length, capacity),
  );
  const hiddenCount = options.length - visibleBadges.length;
  return (
    <div
      ref={ref}
      title={options.map((option) => option.label).join(", ")}
      className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden empty:hidden"
    >
      {visibleBadges.map((option) => (
        <Badge
          tone="brand"
          key={option.value}
          className="h-7 min-w-14 max-w-full shrink gap-1 px-1.5 py-0"
        >
          <span title={option.label} className="min-w-0 truncate">
            {option.label}
          </span>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove ${option.label}`}
            onClick={() => onRemove(option.value)}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-current hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring sm:size-5 sm:pointer-coarse:size-6"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}

function MultiSelectInput({
  value,
  onChange,
  onBlur,
  invalid,
  id,
  label,
  options,
  placeholder = "Select categories...",
  noDataText = "No data",
  disabled = false,
  isLoading = false,
  maxBadgeCount,
}: Readonly<MultiSelectInputProps>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const isDisabled = disabled || isLoading;
  const selectedValues = getSelectedValues(value);
  const selectedOptions = options.filter((option) =>
    selectedValues.includes(option.value),
  );
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.value}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const removeOption = (selected: string) =>
    onChange(selectedValues.filter((item) => item !== selected));
  const toggleOption = (selected: string) => {
    if (selectedValues.includes(selected)) removeOption(selected);
    else onChange([...selectedValues, selected]);
  };
  const emptyMessage = options.length === 0 ? noDataText : "No results found";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          data-slot="multi-select-control"
          className={cn(
            controlClassName,
            "flex h-11 min-w-0 items-center gap-1 py-0 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25 sm:h-10 sm:pointer-coarse:h-11",
            invalid && "border-destructive",
            isDisabled && "cursor-not-allowed bg-muted opacity-75",
          )}
        >
          <SelectedBadges
            options={selectedOptions}
            maxBadgeCount={maxBadgeCount}
            disabled={isDisabled}
            onRemove={removeOption}
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              id={id}
              disabled={isDisabled}
              onBlur={onBlur}
              aria-label={label}
              title={selectedOptions.map((option) => option.label).join(", ")}
              aria-describedby={invalid ? `${id}-error` : undefined}
              className={cn(
                "flex min-w-0 items-center justify-between gap-2 self-stretch text-left text-muted-foreground outline-none",
                selectedOptions.length > 0
                  ? "w-11 shrink-0 sm:w-8 sm:pointer-coarse:w-11"
                  : "flex-1",
              )}
            >
              {isLoading && <span className="truncate">Loading list...</span>}
              {!isLoading && selectedOptions.length === 0 && (
                <span className="truncate">{placeholder}</span>
              )}
              <ChevronDown className="h-4 w-4 ml-auto shrink-0" />
            </button>
          </PopoverTrigger>
          {selectedValues.length > 0 && !disabled && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onChange([])}
              aria-label={`Clear ${label.toLowerCase()}`}
              className="flex w-11 shrink-0 cursor-pointer items-center justify-center self-stretch rounded text-muted-foreground hover:text-foreground sm:w-6 sm:pointer-coarse:w-11"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] min-w-56 p-2 flex flex-col gap-2"
      >
        {options.length > 5 && (
          <SearchInput
            label={`Search ${label.toLowerCase()}`}
            value={search}
            onValueChange={setSearch}
            placeholder={`Search ${label.toLowerCase()}...`}
            wrapperClassName="shrink-0"
          />
        )}
        {options.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1 pb-1 border-b border-border text-xs font-medium text-muted-foreground">
            <span>
              Selected {selectedValues.length}/{options.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange(options.map((option) => option.value))}
                className="min-h-11 sm:min-h-0 sm:pointer-coarse:min-h-11 text-brand-700 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 cursor-pointer"
              >
                Select all
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 sm:pointer-coarse:min-h-11 sm:pointer-coarse:min-w-11 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        <div className="min-h-0 max-h-52 flex-1 overflow-y-auto overscroll-contain space-y-0.5 pr-0.5">
          {filteredOptions.length === 0 && !isLoading && (
            <div className="py-4 text-center text-xs text-muted-foreground italic">
              {emptyMessage}
            </div>
          )}
          {filteredOptions.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleOption(option.value)}
                className={cn(
                  "w-full text-left px-2.5 py-1.5 rounded min-h-11 text-base sm:min-h-0 sm:text-sm sm:pointer-coarse:min-h-11 sm:pointer-coarse:text-base flex items-center justify-between cursor-pointer",
                  isSelected
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <span className="truncate pr-2">{option.label}</span>
                <span
                  className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                    isSelected
                      ? "bg-brand-600 border-brand-500 text-white"
                      : "border-border bg-background",
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MultiSelectField<TFieldValues extends FieldValues>({
  control,
  name,
  required = false,
  className,
  labelAddon,
  valueFormat = "array",
  ...props
}: Readonly<MultiSelectFieldProps<TFieldValues>>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={required ? { required: `${props.label} is required.` } : undefined}
      render={({ field, fieldState }) => (
        <FormFieldShell
          id={props.id}
          label={props.label}
          required={required}
          invalid={fieldState.invalid}
          error={fieldState.error}
          className={className}
          labelAddon={labelAddon}
        >
          <MultiSelectInput
            {...props}
            value={
              valueFormat === "csv" && typeof field.value === "string"
                ? field.value.split(",").filter(Boolean)
                : field.value
            }
            onChange={(values) =>
              field.onChange(valueFormat === "csv" ? values.join(",") : values)
            }
            onBlur={field.onBlur}
            invalid={fieldState.invalid}
          />
        </FormFieldShell>
      )}
    />
  );
}
