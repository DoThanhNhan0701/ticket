import { cn } from "@/lib/utils";
import { BrandWordmark } from "./brand-wordmark";
import "./brand-logo.css";

interface BrandLogoProps {
  variant?: "wordmark" | "mark";
  className?: string;
}

export function BrandLogo({
  variant = "wordmark",
  className,
}: Readonly<BrandLogoProps>) {
  return (
    <span
      className={cn(
        "brand-logo inline-block shrink-0",
        variant === "mark" ? "h-8 w-8" : "h-7 w-44",
        className,
      )}
    >
      {variant === "wordmark" ? (
        <BrandWordmark />
      ) : (
        <>
          <img
            src="/brand/mark-color.svg"
            alt="Rainscales"
            width={157}
            height={177}
            className="block h-full w-full object-contain dark:hidden"
          />
          <img
            src="/brand/mark-white.svg"
            alt="Rainscales"
            width={157}
            height={177}
            className="hidden h-full w-full object-contain dark:block"
          />
        </>
      )}
    </span>
  );
}
