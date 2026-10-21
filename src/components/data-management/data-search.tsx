import { MobilePageAction } from "@/components/layout/mobile-page-action";
import { useId, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { DataFiltersDrawer } from "./data-filters-drawer";
import type { DataFilterField, DataFilterValues } from "./types";

interface DataSearchProps {
  readonly label?: string;
  readonly placeholder?: string;
  readonly initialValue: string;
  readonly filter?: {
    readonly label: string;
    readonly initialValue: string;
    readonly options: readonly { value: string; label: string }[];
    readonly loading?: boolean;
    readonly searchable?: boolean;
    readonly allOptionValue?: string;
  };
  readonly resetKey?: string;
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly iconOnlyOnMobile?: boolean;
  readonly onSearch: (value: string, filterValue: string) => void;
  readonly mobileFilters?: {
    fields: readonly DataFilterField[];
    initialValues: DataFilterValues;
    activeCount: number;
    onApply: (values: DataFilterValues) => void;
    onClear: () => void;
  };
}

function DataSearchForm({
  label = "Tìm kiếm dữ liệu",
  placeholder = "Tìm kiếm nhanh...",
  initialValue,
  filter,
  onSearch,
  iconOnlyOnMobile = false,
}: Readonly<Omit<DataSearchProps, "actions" | "resetKey" | "className">>) {
  const [value, setValue] = useState(initialValue);
  const [filterValue, setFilterValue] = useState(filter?.initialValue ?? "");
  const filterId = useId();
  return (
    <form
      role="search"
      aria-label={label}
      className={cn(
        "row-start-1 grid min-w-0 grid-cols-subgrid items-center gap-2 sm:flex sm:max-w-3xl sm:flex-1",
        filter ? "col-span-full row-span-2" : "col-span-2",
      )}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(value.trim(), filterValue);
      }}
    >
      <SearchInput
        label={label}
        placeholder={placeholder}
        value={value}
        onValueChange={setValue}
        wrapperClassName={filter ? "col-span-full sm:flex-1" : "sm:flex-1"}
      />
      {filter &&
        (filter.searchable ? (
          <SearchableSelect
            id={filterId}
            label={filter.label}
            options={filter.options}
            value={filterValue}
            allOptionValue={filter.allOptionValue}
            disabled={filter.loading}
            onValueChange={setFilterValue}
            className="min-w-0 w-full sm:w-48 sm:shrink-0"
          />
        ) : (
          <Select
            items={filter.options}
            value={filterValue}
            disabled={filter.loading}
            onValueChange={(next) => setFilterValue(next ?? "")}
          >
            <SelectTrigger
              id={filterId}
              aria-label={filter.label}
              className="min-w-0 w-full text-sm sm:w-48 sm:shrink-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      <Button
        type="submit"
        aria-label="Tìm kiếm"
        title="Tìm kiếm"
        className={
          iconOnlyOnMobile ? "w-11 px-0 sm:w-auto sm:px-4" : "px-3 sm:px-4"
        }
      >
        {iconOnlyOnMobile && (
          <Search className="size-4 sm:hidden" aria-hidden="true" />
        )}
        <span className={iconOnlyOnMobile ? "hidden sm:inline" : undefined}>
          Tìm kiếm
        </span>
      </Button>
    </form>
  );
}

export function DataSearch({
  resetKey,
  actions,
  className,
  ...props
}: Readonly<DataSearchProps>) {
  const mobile = useIsMobile();
  if (mobile)
    return (
      <MobileDataSearch {...props} actions={actions} className={className} />
    );
  return (
    <div
      className={cn(
        "grid min-w-0 flex-1 items-center gap-2 sm:flex sm:min-w-md sm:max-w-3xl",
        actions
          ? "grid-cols-[minmax(0,1fr)_auto_auto]"
          : "grid-cols-[minmax(0,1fr)_auto]",
        className,
      )}
    >
      <DataSearchForm
        key={
          resetKey ??
          JSON.stringify([props.initialValue, props.filter?.initialValue])
        }
        {...props}
      />
      {actions && (
        <div
          className={cn(
            "col-start-3 flex items-center",
            props.filter ? "row-start-2" : "row-start-1",
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

function MobileDataSearch({
  initialValue,
  filter,
  label = "Tìm kiếm dữ liệu",
  placeholder = "Nhập từ khóa...",
  mobileFilters,
  actions,
  className,
  onSearch,
}: Readonly<DataSearchProps>) {
  const all = filter?.allOptionValue ?? "all";
  const fields: DataFilterField[] = [
    { name: "search", label, placeholder },
    ...(filter
      ? [
          {
            name: "status",
            label: filter.label,
            placeholder: filter.label,
            type: "select" as const,
            options: filter.options,
            searchable: filter.searchable,
            isLoading: filter.loading,
          },
        ]
      : []),
  ];
  const drawer = (
    <DataFiltersDrawer
      iconOnly
      label="Tìm kiếm nâng cao"
      fields={mobileFilters?.fields ?? fields}
      initialValues={
        mobileFilters?.initialValues ?? {
          search: initialValue,
          status: filter?.initialValue ?? all,
        }
      }
      activeFilterCount={
        mobileFilters?.activeCount ??
        mobileSearchCount(initialValue, filter, all)
      }
      onApply={
        mobileFilters?.onApply ??
        ((values) => onSearch(values.search ?? "", values.status ?? all))
      }
      onClear={mobileFilters?.onClear ?? (() => onSearch("", all))}
    />
  );
  if (mobileFilters || !actions)
    return <MobilePageAction>{drawer}</MobilePageAction>;
  return (
    <MobilePageAction>
      <div
        className={cn(
          "flex min-w-0 flex-none flex-wrap items-center justify-end gap-2",
          className,
        )}
      >
        {actions}
        {drawer}
      </div>
    </MobilePageAction>
  );
}

function mobileSearchCount(
  value: string,
  filter: DataSearchProps["filter"],
  all: string,
) {
  return (
    Number(Boolean(value.trim())) +
    Number(Boolean(filter?.initialValue && filter.initialValue !== all))
  );
}
