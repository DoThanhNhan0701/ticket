import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "./button";

type AsyncButtonProps = Omit<ComponentProps<typeof Button>, "children"> & {
  children: ReactNode;
  loading: boolean;
  loadingText?: ReactNode;
  icon?: ReactNode;
};

export function AsyncButton({
  loading,
  loadingText,
  icon,
  children,
  disabled,
  ...props
}: Readonly<AsyncButtonProps>) {
  return (
    <Button {...props} disabled={disabled || loading} aria-busy={loading}>
      {loading ? (
        <Loader2
          className="h-4 w-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        icon
      )}
      {loading && loadingText ? loadingText : children}
    </Button>
  );
}
