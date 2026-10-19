import { cn } from "@/lib/utils";

export function TruncatedText({
  text,
  className,
  lines = 1,
}: Readonly<{ text: string; className?: string; lines?: 1 | 2 }>) {
  return (
    <span
      title={text}
      className={cn(
        "min-w-0",
        lines === 2
          ? "line-clamp-2 whitespace-normal [overflow-wrap:anywhere]"
          : "block truncate",
        className,
      )}
    >
      {text}
    </span>
  );
}
