import { useState } from "react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  src,
  className,
}: Readonly<{ name: string; src?: string | null; className?: string }>) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const imageUrl = src?.trim();
  const hasImage =
    imageUrl && !["null", "undefined", failedImage].includes(imageUrl);
  const fallback = name ? (
    name[0].toUpperCase()
  ) : (
    <UserRound className="h-4 w-4" />
  );
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-200 bg-brand-50 text-sm font-semibold text-brand-700 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-200",
        className,
      )}
    >
      {hasImage ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedImage(imageUrl)}
        />
      ) : (
        fallback
      )}
    </span>
  );
}
