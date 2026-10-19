import { Component, type ReactNode } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export class AppErrorBoundary extends Component<
  Readonly<{ children: ReactNode }>,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError)
      return (
        <main className="flex min-h-svh items-center justify-center bg-background p-4 text-foreground">
          <div className="w-full max-w-lg space-y-4">
            <EmptyState
              title="Không tải được trang"
              description="Đã xảy ra lỗi khi mở trang. Hãy tải lại trang để thử lại."
              icon={<AlertCircle className="size-6" aria-hidden="true" />}
            />
            <div className="flex justify-center">
              <Button type="button" onClick={() => window.location.reload()}>
                <RotateCw className="size-4" aria-hidden="true" />
                Tải lại trang
              </Button>
            </div>
          </div>
        </main>
      );
    return <>{this.props.children}</>;
  }
}
