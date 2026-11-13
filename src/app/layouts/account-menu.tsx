import { Menu } from "@base-ui/react/menu";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Languages,
  LogOut,
} from "lucide-react";
import { Link } from "react-router-dom";
import { APP_ROUTES } from "@/constants/routes";
import { setLocale, t, useLocale } from "@/i18n";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";

export function AccountMenu() {
  const locale = useLocale();
  const { username, avatarUrl, logout } = useAuthContext();

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        render={
          <Button
            type="button"
            variant="outline"
            className="group h-11 min-w-0 gap-2 border-primary/30 bg-transparent px-2 hover:border-primary/50 hover:bg-white/60 aria-expanded:bg-white/60"
            aria-label={t("layout", "Account menu for {0}", [username])}
          />
        }
      >
        <UserAvatar name={username} src={avatarUrl} className="size-8" />
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
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger
                className="ticket-account-menu-item ticket-menu-item"
                label={t("layout", "Language")}
              >
                <Languages className="size-4" aria-hidden="true" />
                <span>{t("layout", "Language")}</span>
                <ChevronRight className="ml-auto size-4" aria-hidden="true" />
              </Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner
                  side="left"
                  align="start"
                  sideOffset={8}
                  collisionPadding={12}
                  className="z-50"
                >
                  <Menu.Popup
                    aria-label={t("layout", "Language")}
                    className="ticket-account-menu"
                  >
                    <Menu.RadioGroup
                      value={locale}
                      onValueChange={(value) => {
                        if (value === "vi" || value === "en") setLocale(value);
                      }}
                    >
                      {[
                        { value: "vi", label: "Tiếng Việt" },
                        { value: "en", label: "English" },
                      ].map((language) => (
                        <Menu.RadioItem
                          key={language.value}
                          value={language.value}
                          label={language.label}
                          className="ticket-account-menu-item ticket-menu-item"
                          closeOnClick
                        >
                          <span lang={language.value}>{language.label}</span>
                          <Menu.RadioItemIndicator className="ml-auto">
                            <Check className="size-4" aria-hidden="true" />
                          </Menu.RadioItemIndicator>
                        </Menu.RadioItem>
                      ))}
                    </Menu.RadioGroup>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
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
