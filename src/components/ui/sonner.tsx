import { useTheme } from "next-themes";
import { t, useLocale } from "@/i18n";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  useLocale();
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      containerAriaLabel={t("common", "Thông báo")}
      theme={resolvedTheme === "light" ? "light" : "dark"}
      richColors
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--error-bg": "var(--danger-soft)",
          "--error-text": "var(--destructive)",
          "--error-border": "var(--danger-border)",
          "--success-bg": "var(--success-soft)",
          "--success-text": "var(--success)",
          "--success-border":
            "color-mix(in srgb, var(--success) 40%, transparent)",
          "--warning-bg": "var(--warning-soft)",
          "--warning-text": "var(--warning)",
          "--warning-border":
            "color-mix(in srgb, var(--warning) 40%, transparent)",
          "--description-color": "var(--muted-foreground)",
          "--border-radius": "8px",
        } as React.CSSProperties
      }
      toastOptions={{
        closeButtonAriaLabel: t("common", "Đóng thông báo"),
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
