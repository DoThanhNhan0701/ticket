import { Menu } from "@base-ui/react/menu";
import { BookOpen, ChevronDown, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { APP_ROUTES } from "@/constants/routes";
import { t, useLocale } from "@/i18n";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";

export function AccountMenu() {
  useLocale();
  const { username, avatarUrl, logout } = useAuthContext();

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        render={
          <Button
            type="button"
            variant="outline"
            className="group h-8 min-w-0 gap-1.5 border-primary/30 bg-transparent px-1.5 hover:border-primary/50 hover:bg-white/60 aria-expanded:bg-white/60"
            aria-label={t("layout", "Account menu for {0}", [username])}
          />
        }
      >
        <UserAvatar name={username} src={avatarUrl} className="size-6" />
        <span className="max-w-24 truncate text-sm font-medium sm:max-w-40">
          {username}
        </span>
        <ChevronDown
          className="size-4 shrink-0 transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50"
        >
          <Menu.Popup
            aria-label={t("layout", "Main navigation")}
            className="ticket-account-menu"
          >
            <Menu.LinkItem
              render={<Link to={APP_ROUTES.help} />}
              label={t("layout", "Hướng dẫn sử dụng")}
              className="ticket-account-menu-item ticket-menu-item"
              closeOnClick
            >
              <BookOpen className="size-4" aria-hidden="true" />
              <span>{t("layout", "Hướng dẫn sử dụng")}</span>
            </Menu.LinkItem>
            <Menu.Separator className="ticket-account-menu-separator" />
            <Menu.Item
              className="ticket-account-menu-item ticket-menu-item"
              onClick={() => void logout()}
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span>{t("layout", "Sign Out")}</span>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
