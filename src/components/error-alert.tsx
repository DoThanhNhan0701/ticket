import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ErrorAlert({ message }: Readonly<{ message: string }>) {
  return (
    <Alert
      variant="destructive"
      className="border-danger-border bg-danger-soft p-3"
    >
      <AlertCircle aria-hidden="true" />
      <AlertDescription className="text-destructive">
        {message}
      </AlertDescription>
    </Alert>
  );
}
