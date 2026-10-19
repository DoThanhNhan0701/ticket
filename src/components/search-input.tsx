import { useRef, type ComponentProps } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "ref"
> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  wrapperClassName?: string;
};

export function SearchInput({
  label,
  value,
  onValueChange,
  wrapperClassName,
  className,
  disabled,
  ...props
}: Readonly<SearchInputProps>) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("relative min-w-0", wrapperClassName)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        {...props}
        ref={inputRef}
        type="search"
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(
          "pl-9 pr-12 [&::-webkit-search-cancel-button]:appearance-none",
          className,
        )}
      />
      {value && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onValueChange("");
            inputRef.current?.focus();
          }}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="absolute top-1/2 right-0.5 flex h-11 w-11 sm:h-9 sm:w-9 sm:pointer-coarse:h-11 sm:pointer-coarse:w-11 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
