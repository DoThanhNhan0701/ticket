import * as React from "react";

import { controlClassName } from "./control-styles";
import { cn } from "@/lib/utils";

function Textarea({
  className,
  rows = 3,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(controlClassName, "field-sizing-fixed", className)}
      {...props}
    />
  );
}

export { Textarea };
