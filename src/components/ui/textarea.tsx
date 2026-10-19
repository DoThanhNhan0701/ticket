import * as React from "react";

import { controlClassName } from "./control-styles";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        controlClassName,
        "field-sizing-content min-h-24",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
