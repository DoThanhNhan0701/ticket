import { useState } from "react";

const storageKey = "ticket.sidebar";
interface SidebarPreferences {
  collapsed: boolean;
  groups: Record<string, boolean>;
}

function readPreferences(): SidebarPreferences {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? "null",
    );
    if (saved && typeof saved === "object") {
      const { collapsed, groups } = saved as Partial<SidebarPreferences>;
      return {
        collapsed: collapsed === true,
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
  return { collapsed: false, groups: {} };
}

export function useSidebarPreferences() {
  const [preferences, setPreferences] = useState(readPreferences);
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
    toggleCollapsed: () =>
      update({ ...preferences, collapsed: !preferences.collapsed }),
    toggleGroup: (label: string, open: boolean) =>
      update({
        ...preferences,
        groups: { ...preferences.groups, [label]: open },
      }),
  };
}
