import { ErrorToast } from "@/components/error-toast";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onRetry: () => void;
}

function PermissionInfoContent({
  permissions,
  loading,
  error,
  onRetry,
}: Readonly<PermissionInfoProps>) {
  if (loading) return <LoadingState message="Đang tải quyền hạn..." />;
  if (error)
    return (
      <div className="space-y-3">
        <ErrorToast message={error.message} />
        <Button variant="outline" onClick={onRetry}>
          Thử lại quyền hạn
        </Button>
      </div>
    );
  if (permissions.length === 0)
    return <p className="text-sm text-muted-foreground">Chưa có quyền hạn.</p>;
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
              {info.retired && <Badge tone="neutral">Ngừng cấp mới</Badge>}
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogHeading
            icon={<ShieldCheck aria-hidden="true" />}
            title="Thông tin quyền hạn"
            description="Các quyền đang dùng và quyền đã ngừng cấp mới."
          />
          <DialogCloseButton aria-label="Đóng thông tin quyền hạn" />
        </DialogHeader>
        <PermissionInfoContent {...props} />
      </DialogContent>
    </Dialog>
  );
}
