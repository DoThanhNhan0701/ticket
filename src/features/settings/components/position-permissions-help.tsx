import { t, useLocale } from "@/i18n";
import { ErrorToast } from "@/components/error-toast";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/loading-state";
import type { SettingsRecord } from "../types";
import { getPositionPermissionInfo } from "../utils/position-permissions";

interface PermissionInfoProps {
  permissions: readonly SettingsRecord[];
  loading: boolean;
  error: Error | null;
}

function PermissionInfoContent({
  permissions,
  loading,
  error,
}: Readonly<PermissionInfoProps>) {
  useLocale();
  if (loading)
    return (
      <LoadingState
        message={t("settings-positions", "Đang tải quyền hạn...")}
      />
    );
  if (error) return <ErrorToast message={error.message} />;
  if (permissions.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {t("settings-positions", "Chưa có quyền hạn.")}
      </p>
    );
  return (
    <dl className="space-y-3">
      {permissions.map((permission) => {
        const info = getPositionPermissionInfo(
          permission.name,
          permission.description,
        );
        return (
          <div
            key={permission.id}
            className="space-y-1 rounded-lg border border-border bg-muted/30 p-3"
          >
            <dt className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span>{info.label}</span>
              {info.retired && (
                <Badge tone="neutral">
                  {t("settings-positions", "Ngừng cấp mới")}
                </Badge>
              )}
            </dt>
            <dd className="text-xs leading-5 text-muted-foreground">
              {info.description}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function PositionPermissionsHelp({
  open,
  onOpenChange,
  ...props
}: Readonly<
  PermissionInfoProps & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }
>) {
  useLocale();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogHeading
            icon={<ShieldCheck aria-hidden="true" />}
            title={t("settings-positions", "Thông tin quyền hạn")}
            description={t(
              "settings-positions",
              "Các quyền đang dùng và quyền đã ngừng cấp mới.",
            )}
          />
          <DialogCloseButton
            aria-label={t("settings-positions", "Đóng thông tin quyền hạn")}
          />
        </DialogHeader>
        <PermissionInfoContent {...props} />
      </DialogContent>
    </Dialog>
  );
}
