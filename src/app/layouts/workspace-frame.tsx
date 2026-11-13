import type { ReactNode } from "react";
import { t, useLocale } from "@/i18n";
import { cn } from "@/lib/utils";
import "@/styles/homepage-dashboard-background.css";

export function WorkspaceFrame({
  header,
  sidebar,
  sidebarCollapsed = false,
  busy = false,
  children,
}: Readonly<{
  header: ReactNode;
  sidebar: ReactNode;
  sidebarCollapsed?: boolean;
  busy?: boolean;
  children: ReactNode;
}>) {
  useLocale();
  return (
    <div
      data-workspace-frame=""
      className="homepage-dashboard-background flex h-dvh min-h-0 flex-col overflow-hidden text-foreground"
    >
      <header className="h-16 shrink-0 border-b border-border">
        <div className="flex h-full items-center justify-between gap-2 px-[clamp(0.75rem,2vw,1.5rem)]">
          {header}
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside
          id="desktop-sidebar"
          aria-label={t("layout", "Sidebar Ticket")}
          className={cn(
            "hidden min-h-0 shrink-0 overflow-hidden border-r border-sidebar-border transition-[width] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:block",
            sidebarCollapsed ? "w-18" : "w-72",
          )}
        >
          {sidebar}
        </aside>
        <main
          aria-busy={busy}
          className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-3 sm:p-6"
        >
          <div className="flex h-full min-h-full min-w-0 w-full flex-1 flex-col">
            {children}
          </div>
        </main>
      </div>
      <footer className="shrink-0 border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
        {t("layout", "© 2026 Rainscales · Ticket")}
      </footer>
    </div>
  );
}
