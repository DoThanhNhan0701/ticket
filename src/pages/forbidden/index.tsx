import { ShieldX, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_ROUTES } from "@/constants/routes";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";

export function ForbiddenPage() {
  const { logout } = useAuthContext();
  const navigate = useNavigate();
  return (
    <main className="app-dashed-background flex min-h-dvh items-center justify-center bg-background px-5 py-10 text-foreground">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <section className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-9">
        <BrandLogo className="h-8 w-44 max-w-full" />
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldX className="size-7" aria-hidden="true" />
        </div>
        <div className="space-y-3">
          <h1 className="text-xl font-semibold">Bạn chưa có quyền truy cập</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Phiên đăng nhập không phù hợp với môi trường hiện tại hoặc tài khoản
            chưa được cấp quyền. Vui lòng đăng nhập lại hoặc liên hệ quản trị
            viên.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            logout();
            navigate(APP_ROUTES.login, { replace: true });
          }}
        >
          <LogIn className="size-4" aria-hidden="true" />
          Đăng nhập lại
        </Button>
      </section>
    </main>
  );
}
