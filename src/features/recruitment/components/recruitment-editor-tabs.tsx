import { t, useLocale } from "@/i18n";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { History, UserRound } from "lucide-react";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RecruitmentNoteHistory } from "./recruitment-note-history";

export function RecruitmentEditorTabs({
  candidateId,
  busy,
  onClose,
  children,
}: Readonly<{
  candidateId: number;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}>) {
  useLocale();
  const [tab, setTab] = useState("info");
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scroll = root.current?.parentElement;
    if (scroll) scroll.scrollTop = 0;
  }, [tab]);
  const tabClassName =
    "flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted data-[active]:bg-primary data-[active]:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";
  return (
    <Tabs.Root ref={root} value={tab} onValueChange={setTab}>
      <Tabs.List
        aria-label={t("recruitment", "Hồ sơ ứng viên")}
        activateOnFocus
        className="sticky top-14 z-10 mb-4 flex gap-1 rounded-xl border bg-card p-1 shadow-sm"
      >
        <Tabs.Tab value="info" disabled={busy} className={tabClassName}>
          <UserRound aria-hidden="true" className="size-4" />
          {t("recruitment", "Thông tin")}
        </Tabs.Tab>
        <Tabs.Tab value="history" disabled={busy} className={tabClassName}>
          <History aria-hidden="true" className="size-4" />
          {t("recruitment", "Lịch sử")}
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="info" keepMounted>
        {children}
      </Tabs.Panel>
      <Tabs.Panel value="history">
        <RecruitmentNoteHistory candidateId={candidateId} />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setTab("info")}
          >
            {t("recruitment", "Quay lại thông tin")}
          </Button>
          <Button type="button" onClick={onClose}>
            {t("recruitment", "Đóng")}
          </Button>
        </DialogFooter>
      </Tabs.Panel>
    </Tabs.Root>
  );
}
