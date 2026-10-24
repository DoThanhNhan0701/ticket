import { translateMessage, useLocale } from "@/i18n";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ErrorAlert({ message }: Readonly<{ message: string }>) {
  useLocale();
  message = translateMessage(message);
  return (
    <Alert
      variant="destructive"
      className="min-w-0 items-center gap-y-0 border-danger-border bg-danger-soft px-3 py-2.5 has-[>svg]:grid-cols-[auto_minmax(0,1fr)] *:[svg]:row-span-1 *:[svg]:translate-y-0"
    >
      <AlertCircle aria-hidden="true" />
      <AlertDescription
        className="min-w-0 truncate text-nowrap leading-5 text-destructive md:text-nowrap"
        title={message}
      >
        {message}
      </AlertDescription>
    </Alert>
  );
}
