import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({
  message = "Loading...",
  className,
}: Readonly<{ message?: string; className?: string }>) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-32 flex-1 flex-col items-center justify-center gap-3 p-8 text-sm font-medium text-muted-foreground",
        className,
      )}
    >
      <Loader2
        aria-hidden="true"
        className="h-5 w-5 animate-spin text-primary motion-reduce:animate-none"
      />
      <span>{message}</span>
    </div>
  );
}
