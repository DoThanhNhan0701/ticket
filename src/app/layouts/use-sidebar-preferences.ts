import Cookies from "js-cookie";
import { useEffect, useState } from "react";
import { setCookie } from "@/lib/cookies";

const storageKey = "ticket.sidebar";
const collapseCookie = "rainscales_sidebar_collapsed";
interface SidebarPreferences {
  collapsed: boolean;
  groups: Record<string, boolean>;
}

function readSharedCollapse(): boolean | undefined {
  const value = Cookies.get(collapseCookie);
  if (value === "true") return true;
  if (value === "false") return false;
}

function readPreferences(): SidebarPreferences {
  const sharedCollapse = readSharedCollapse();
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? "null",
    );
    if (saved && typeof saved === "object") {
      const { collapsed, groups } = saved as Partial<SidebarPreferences>;
      return {
        collapsed: sharedCollapse ?? collapsed === true,
        groups:
          groups && typeof groups === "object"
            ? Object.fromEntries(
                Object.entries(groups).filter(
                  ([, open]) => typeof open === "boolean",
                ),
              )
            : {},
      };
    }
  } catch {
    // Storage may be unavailable or contain invalid data.
  }
  return { collapsed: sharedCollapse ?? false, groups: {} };
}

export function useSidebarPreferences() {
  const [preferences, setPreferences] = useState(readPreferences);

  useEffect(() => {
    const sync = () => {
      const collapsed = readSharedCollapse();
      if (collapsed === undefined) return;
      setPreferences((current) =>
        current.collapsed === collapsed ? current : { ...current, collapsed },
      );
    };
    const syncVisible = () => {
      if (!document.hidden) sync();
    };

    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", syncVisible);
    // A sibling subdomain can update the shared cookie without a storage event.
    const timer = window.setInterval(syncVisible, 1000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", syncVisible);
    };
  }, []);

  const update = (next: SidebarPreferences) => {
    setPreferences(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Navigation still works when the browser blocks persistent storage.
    }
  };
  return {
    ...preferences,
    toggleCollapsed: () => {
      const collapsed = !preferences.collapsed;
      setCookie(collapseCookie, String(collapsed), 365);
      update({ ...preferences, collapsed });
    },
    toggleGroup: (label: string, open: boolean) =>
      update({
        ...preferences,
        groups: { ...preferences.groups, [label]: open },
      }),
  };
}
