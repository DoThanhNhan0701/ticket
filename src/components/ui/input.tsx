import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { controlClassName } from "./control-styles";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(controlClassName, "min-w-0 text-ellipsis", className)}
      {...props}
    />
  );
}

export { Input };
