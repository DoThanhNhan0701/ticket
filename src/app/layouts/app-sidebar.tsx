import { useEffect, useRef, useState, type RefObject } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronDown, Menu, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { cn } from "@/lib/utils";
import {
  canAccessPage,
  isPageActive,
  navigationGroups,
  type NavigationGroup,
  type WorkspacePageDefinition,
} from "../navigation";

interface SidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

function CollapsedSidebarGroup({
  group,
  active,
  onNavigate,
}: Readonly<{
  group: NavigationGroup;
  active: boolean;
  onNavigate?: () => void;
}>) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const Icon = group.icon;
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnMobile = () => {
      if (!desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnMobile);
    return () => desktop.removeEventListener("change", closeOnMobile);
  }, [open]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip disabled={open}>
        <PopoverTrigger asChild>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={group.label}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "relative size-11 rounded-xl",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs ring-1 ring-inset ring-sidebar-ring/20 hover:bg-sidebar-accent"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              />
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            {active && (
              <span
                className="absolute top-1/2 -left-2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                aria-hidden="true"
              />
            )}
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent side="right" sideOffset={12}>
          {group.label}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        ref={contentRef}
        side="right"
        align="start"
        sideOffset={24}
        collisionPadding={12}
        aria-label={group.label}
        className="w-64 max-w-[calc(100vw-2rem)] p-2"
        onOpenAutoFocus={(event) => {
          const firstLink =
            contentRef.current?.querySelector<HTMLAnchorElement>("a[href]");
          if (firstLink) {
            event.preventDefault();
            firstLink.focus();
          }
        }}
      >
        <h2 className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground">
          {group.label}
        </h2>
        <nav aria-label={group.label}>
          <ul className="space-y-1">
            {group.pages.map((page) => (
              <li key={page.path}>
                <SidebarLink
                  page={page}
                  onNavigate={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                />
              </li>
            ))}
          </ul>
        </nav>
      </PopoverContent>
    </Popover>
  );
}

function SidebarLink({
  page,
  onNavigate,
}: Readonly<{ page: WorkspacePageDefinition; onNavigate?: () => void }>) {
  const { pathname } = useLocation();
  const active = isPageActive(page, pathname);
  const Icon = page.icon;

  return (
    <Link
      to={page.path}
      onClick={onNavigate}
      aria-label={page.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-sidebar-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{page.label}</span>
      {active && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

export function AppSidebar({
  collapsed = false,
  onNavigate,
}: Readonly<SidebarProps>) {
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
      <nav
        aria-label="Điều hướng Ticket"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-4"
      >
        <div
          className={cn(
            collapsed ? "flex flex-col items-center gap-2" : "space-y-1",
          )}
        >
          {groups.map((group) => {
            const active = group.pages.some((page) =>
              isPageActive(page, pathname),
            );
            const Icon = group.icon;
            if (collapsed) {
              return (
                <CollapsedSidebarGroup
                  key={group.label}
                  group={group}
                  active={active}
                  onNavigate={onNavigate}
                />
              );
            }
            const links = (
              <ul className="ml-3 space-y-1 border-l border-sidebar-border pl-2">
                {group.pages.map((page) => (
                  <li key={page.path}>
                    <SidebarLink page={page} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            );

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

      <div
        title={collapsed ? "Rainscales · Internal workspace" : undefined}
        className="flex min-h-12 shrink-0 items-center justify-center gap-2 border-t border-sidebar-border px-4 py-3 text-xs text-muted-foreground"
      >
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
