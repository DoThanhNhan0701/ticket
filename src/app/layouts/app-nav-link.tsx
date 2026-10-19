import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function AppNavLink({
  to,
  label,
  icon: Icon,
}: Readonly<{ to: string; label: string; icon: LucideIcon }>) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "h-9 w-9 gap-1.5 px-0 text-[0.8rem] lg:w-auto lg:px-3",
          isActive && "border-primary bg-accent text-accent-foreground",
        )
      }
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="hidden lg:inline">{label}</span>
    </NavLink>
  );
}
