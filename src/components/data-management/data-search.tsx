import { useId, useState } from "react";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export function DataSearch({
  label = "Tìm kiếm dữ liệu",
  placeholder = "Tìm kiếm nhanh...",
  initialValue,
  filter,
  onSearch,
}: Readonly<{
  label?: string;
  placeholder?: string;
  initialValue: string;
  filter?: {
    readonly label: string;
    readonly initialValue: string;
    readonly options: readonly { value: string; label: string }[];
    readonly loading?: boolean;
  };
  onSearch: (value: string, filterValue: string) => void;
}>) {
  const [value, setValue] = useState(initialValue);
  const [filterValue, setFilterValue] = useState(filter?.initialValue ?? "");
  const filterId = useId();
  return (
    <form
      role="search"
      aria-label={label}
      className="flex min-w-[32rem] max-w-3xl flex-1 items-center gap-2"
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
        wrapperClassName="flex-1"
      />
      {filter && (
        <Select
          items={filter.options}
          value={filterValue}
          disabled={filter.loading}
          onValueChange={(next) => setFilterValue(next ?? "")}
        >
          <SelectTrigger
            id={filterId}
            aria-label={filter.label}
            className="w-48 shrink-0"
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
      )}
      <Button type="submit">Tìm kiếm</Button>
    </form>
  );
}
