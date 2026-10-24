import { t, useLocale } from "@/i18n";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const label = isDark
    ? t("layout", "Switch to light theme")
    : t("layout", "Switch to dark theme");
  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className="size-11 shrink-0 rounded-md border-border bg-card text-foreground hover:bg-accent sm:size-9 sm:pointer-coarse:size-11"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
