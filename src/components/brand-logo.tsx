import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "wordmark" | "mark";
  className?: string;
}

export function BrandLogo({
  variant = "wordmark",
  className,
}: Readonly<BrandLogoProps>) {
  const asset = variant === "mark" ? "mark" : "logo";
  const width = variant === "mark" ? 157 : 402;
  const height = variant === "mark" ? 177 : 66;

  return (
    <span
      className={cn(
        "inline-block shrink-0",
        variant === "mark" ? "h-8 w-8" : "h-7 w-44",
        className,
      )}
    >
      <img
        src={`/brand/${asset}-color.svg`}
        alt="Rainscales"
        width={width}
        height={height}
        className="block h-full w-full object-contain dark:hidden"
      />
      <img
        src={`/brand/${asset}-white.svg`}
        alt="Rainscales"
        width={width}
        height={height}
        className="hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
}
