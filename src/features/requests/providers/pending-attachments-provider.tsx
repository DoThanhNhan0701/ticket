import { t, useLocale } from "@/i18n";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useBlocker } from "react-router-dom";
import { Paperclip } from "lucide-react";
import { APP_ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogFooter,
} from "@/components/ui/dialog";
import { PendingAttachmentsContext } from "../context/pending-attachments-context";

export function PendingAttachmentsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  useLocale();
  const [sources, setSources] = useState<Record<string, number>>({});
  const update = useCallback((id: string, count: number) => {
    setSources((previous) => {
      if ((previous[id] ?? 0) === count) return previous;
      const next = { ...previous };
      if (count) next[id] = count;
      else delete next[id];
      return next;
    });
  }, []);
  const count = Object.values(sources).reduce(
    (total, value) => total + value,
    0,
  );
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    // Authentication redirects must still work when a session expires.
    if (
      [APP_ROUTES.login, APP_ROUTES.forbidden].some(
        (path) => path === nextLocation.pathname,
      )
    )
      return false;
    // Detail panels stay mounted when switching tabs, so drafts remain intact.
    return count > 0 && currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (!count) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [count]);
  useEffect(() => {
    if (!count && blocker.state === "blocked") blocker.proceed();
  }, [count, blocker]);

  return (
    <PendingAttachmentsContext value={update}>
      {children}
      <Dialog
        open={blocker.state === "blocked" && count > 0}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogHeading
              icon={<Paperclip aria-hidden="true" />}
              title={t("attachments", "Tệp đính kèm chưa được gửi")}
              description={t(
                "attachments",
                "Bạn còn {0} tệp đính kèm chưa gửi hoặc tải lên. Nếu rời trang, các tệp đã chọn sẽ bị mất.",
                [count],
              )}
            />
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => blocker.state === "blocked" && blocker.reset()}
            >
              {t("attachments", "Ở lại")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => blocker.state === "blocked" && blocker.proceed()}
            >
              {t("attachments", "Rời trang")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PendingAttachmentsContext>
  );
}
