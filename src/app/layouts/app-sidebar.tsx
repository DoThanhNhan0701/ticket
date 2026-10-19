import { useEffect, useState, type RefObject } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronDown, Menu, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { cn } from "@/lib/utils";
import {
  canAccessPage,
  isPageActive,
  navigationGroups,
  type WorkspacePageDefinition,
} from "../navigation";

interface SidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

function SidebarLink({
  page,
  collapsed,
  onNavigate,
}: SidebarProps & { page: WorkspacePageDefinition }) {
  const { pathname } = useLocation();
  const active = isPageActive(page, pathname);
  const Icon = page.icon;

  return (
    <Link
      to={page.path}
      onClick={onNavigate}
      aria-label={page.label}
      aria-current={active ? "page" : undefined}
      title={collapsed ? page.label : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-sidebar-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className={collapsed ? "sr-only" : "min-w-0 flex-1"}>
        {page.label}
      </span>
      {active && !collapsed && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

export function AppSidebar({ collapsed = false, onNavigate }: SidebarProps) {
  const { permissions } = useAuthContext();
  const { pathname } = useLocation();
  const groups = navigationGroups
    .map((group) => ({
      ...group,
      pages: group.pages.filter((page) => canAccessPage(page, permissions)),
    }))
    .filter((group) => group.pages.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col text-sidebar-foreground">
      <div className={cn("shrink-0 p-3", !collapsed && "px-4 pt-5")}>
        <p
          className={cn(
            "px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground",
            collapsed && "sr-only",
          )}
        >
          Không gian làm việc
        </p>
      </div>

      <nav
        aria-label="Điều hướng Ticket"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4"
      >
        <div className="space-y-1">
          {groups.map((group) => {
            const active = group.pages.some((page) =>
              isPageActive(page, pathname),
            );
            const Icon = group.icon;
            const links = (
              <ul
                className={cn(
                  "space-y-1",
                  !collapsed && "ml-3 border-l border-sidebar-border pl-2",
                )}
              >
                {group.pages.map((page) => (
                  <li key={page.path}>
                    <SidebarLink
                      page={page}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            );

            if (collapsed) {
              return (
                <section
                  key={group.label}
                  aria-label={group.label}
                  className="border-t border-sidebar-border py-2"
                >
                  <h2 className="sr-only">{group.label}</h2>
                  {links}
                </section>
              );
            }

            return (
              <details
                key={`${group.label}:${active}`}
                open={active || group.label === "Yêu cầu"}
                className="group/sidebar-section"
              >
                <summary
                  className={cn(
                    "flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-sidebar-ring [&::-webkit-details-marker]:hidden",
                    active
                      ? "text-sidebar-accent-foreground"
                      : "text-sidebar-foreground",
                  )}
                >
                  <Icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">{group.label}</span>
                  <ChevronDown
                    className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/sidebar-section:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="pb-2 pt-1">{links}</div>
              </details>
            );
          })}
        </div>
      </nav>

      <div className="flex min-h-12 shrink-0 items-center justify-center gap-2 border-t border-sidebar-border px-4 py-3 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
        <span className={collapsed ? "sr-only" : undefined}>
          Rainscales · Internal workspace
        </span>
      </div>
    </div>
  );
}

export function MobileSidebar({
  desktopToggleRef,
}: Readonly<{ desktopToggleRef: RefObject<HTMLButtonElement | null> }>) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="size-11 lg:hidden"
            aria-label="Mở menu điều hướng"
          />
        }
      >
        <Menu className="size-4" aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity data-closed:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex">
          <Dialog.Popup
            finalFocus={() =>
              window.matchMedia("(min-width: 1024px)").matches
                ? desktopToggleRef.current
                : true
            }
            className="flex h-dvh w-76 max-w-[calc(100vw-2rem)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl outline-none transition-transform data-closed:-translate-x-full"
          >
            <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-4">
              <Dialog.Title className="text-base font-semibold">
                Điều hướng Ticket
              </Dialog.Title>
              <Dialog.Close
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    aria-label="Đóng menu điều hướng"
                  />
                }
              >
                <X className="size-4" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <AppSidebar onNavigate={() => setOpen(false)} />
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
