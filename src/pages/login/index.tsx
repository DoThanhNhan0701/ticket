import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LockKeyhole } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { ErrorToast } from "@/components/error-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { PasswordField } from "@/components/form/password-field";
import { InputField } from "@/components/form/input-field";
import {
  loginSchema,
  LoginFormValues,
} from "@/features/auth/schemas/login-schema";

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

export function LoginPage({
  onLogin,
  isLoading,
  error,
  setError,
}: Readonly<LoginPageProps>) {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    await onLogin(data.username, data.password);
  };

  return (
    <div className="app-dashed-background relative flex min-h-svh w-full bg-background text-foreground">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <section
        aria-label="Rainscales Ticket workspace"
        className="hidden w-105 shrink-0 flex-col justify-between gap-10 border-r border-border bg-card p-10 lg:flex xl:w-125 xl:p-12"
      >
        <BrandLogo className="h-9 w-56 max-w-full" />
        <div>
          <Badge tone="brand" className="mb-5">
            Your internal ticket workspace
          </Badge>
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight">
            Rainscales
            <br />
            Ticket
          </h1>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-muted-foreground">
            Sign in with your Rainscales account to access the internal Ticket
            workspace.
          </p>
          <img
            src="/brand/scout-telescope.png"
            alt=""
            width={500}
            height={250}
            className="mt-6 h-auto w-44 select-none"
          />
        </div>
        <div className="space-y-4">
          {[
            "Dedicated Ticket Workspace",
            "Rainscales Account Access",
            "Secure Sign-in",
          ].map((label) => (
            <div
              key={label}
              className="flex items-center gap-3 text-sm font-medium"
            >
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>{label}</span>
            </div>
          ))}
          <p className="border-t border-border pt-5 text-xs text-muted-foreground">
            © 2026 Rainscales · Ticket
          </p>
        </div>
      </section>
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-8">
        <div className="w-full max-w-105">
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandLogo className="h-9 w-56 max-w-full" />
          </div>
          <Card className="gap-6 p-6 shadow-md sm:p-8">
            <CardHeader className="gap-2 p-0">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Sign In to Ticket
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Enter your Rainscales credentials to access Ticket.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                {error && <ErrorToast message={error} />}
                <FieldGroup className="gap-5">
                  <InputField
                    control={form.control}
                    name="username"
                    id="login-username"
                    label="Username"
                    placeholder="Enter username"
                    autoComplete="username"
                    disabled={isLoading}
                    required
                  />
                  <PasswordField
                    control={form.control}
                    name="password"
                    id="login-password"
                    label="Password"
                    placeholder="Enter password"
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                  />
                </FieldGroup>
                <AsyncButton
                  type="submit"
                  loading={isLoading}
                  loadingText="Authenticating..."
                  className="w-full"
                >
                  Sign In to Ticket
                </AsyncButton>
              </form>
            </CardContent>
            <div className="flex items-center justify-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              Authorized personnel only
            </div>
          </Card>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            Rainscales Ticket · © 2026
          </p>
        </div>
      </main>
    </div>
  );
}
