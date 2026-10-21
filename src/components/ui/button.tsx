import { Children, isValidElement, type ReactNode } from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

import { buttonVariants } from "./button-variants";

function Button({
  className,
  variant = "default",
  size = "default",
  mobileIconOnly = false,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    mobileIconOnly?: boolean;
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, className }),
        mobileIconOnly && "max-sm:size-11 max-sm:gap-0 max-sm:px-0",
      )}
      {...props}
    >
      {mobileIconOnly
        ? Children.map(children, (child) =>
            isButtonLabel(child) ? (
              <span className="max-sm:sr-only">{child}</span>
            ) : (
              child
            ),
          )
        : children}
    </ButtonPrimitive>
  );
}

function isButtonLabel(child: ReactNode) {
  return (
    typeof child === "string" ||
    typeof child === "number" ||
    (isValidElement(child) && child.type === "span")
  );
}

export { Button };
