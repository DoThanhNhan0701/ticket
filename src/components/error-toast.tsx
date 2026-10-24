import { translateMessage, useLocale } from "@/i18n";
import { useEffect, useId } from "react";
import { localizedToast as toast } from "@/i18n/toast";

export function ErrorToast({ message }: Readonly<{ message: string }>) {
  useLocale();
  message = translateMessage(message);
  const id = useId();

  useEffect(() => {
    toast.error(message, { id });
  }, [id, message]);

  return null;
}
