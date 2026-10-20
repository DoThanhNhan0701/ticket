import { useId, useState, type ReactNode } from "react";
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
  readonly onSearch: (value: string, filterValue: string) => void;
}

function DataSearchForm({
  label = "Tìm kiếm dữ liệu",
  placeholder = "Tìm kiếm nhanh...",
  initialValue,
  filter,
  onSearch,
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
      <Button type="submit" className="px-3 sm:px-4">
        Tìm kiếm
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
