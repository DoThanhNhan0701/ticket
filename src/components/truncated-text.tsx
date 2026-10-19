import { cn } from "@/lib/utils";

export function TruncatedText({
  text,
  className,
}: Readonly<{ text: string; className?: string }>) {
  return (
    <span title={text} className={cn("block min-w-0 truncate", className)}>
      {text}
    </span>
  );
}
