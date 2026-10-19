import { BrandLogo } from "@/components/brand-logo";
import { LoadingState } from "@/components/loading-state";

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-6 px-6">
        <BrandLogo className="h-10 w-64 max-w-full" />
        <LoadingState
          message="Loading your Ticket workspace..."
          className="min-h-0 flex-none flex-row p-0"
        />
      </div>
    </div>
  );
}
