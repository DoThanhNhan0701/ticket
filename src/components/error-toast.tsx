import { useEffect, useId } from "react";
import { toast } from "sonner";

export function ErrorToast({ message }: Readonly<{ message: string }>) {
  const id = useId();

  useEffect(() => {
    toast.error(message, { id });
  }, [id, message]);

  return null;
}
