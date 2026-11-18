import type { ReactNode } from "react";
import { t } from "@/i18n";
import { BrandLogo } from "@/components/brand-logo";
import { AccountMenu } from "./account-menu";

export function WorkspaceHeader({
  loading = false,
  mobileNavigation,
}: Readonly<{
  loading?: boolean;
  mobileNavigation?: ReactNode;
}>) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-11 shrink-0 items-center justify-center lg:hidden">
          {loading ? (
            <div
              aria-hidden="true"
              className="size-full rounded-lg bg-(--workspace-skeleton-soft)"
            />
          ) : (
            mobileNavigation
          )}
        </div>
        <a
          href={loading ? undefined : import.meta.env.VITE_HOMEPAGE_URL}
          aria-label={
            loading ? undefined : t("layout", "Rainscales Ticket home")
          }
          className="flex shrink-0 items-center rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <BrandLogo variant="mark" className="size-8 sm:hidden" />
          <BrandLogo className="hidden h-7 w-[clamp(5.5rem,calc(100vw-16rem),10rem)] sm:inline-block" />
        </a>
      </div>
      {loading ? (
        <div
          aria-hidden="true"
          className="h-11 w-36 shrink-0 rounded-lg bg-(--workspace-skeleton-soft)"
        />
      ) : (
        <AccountMenu />
      )}
    </>
  );
}
