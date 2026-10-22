import { PAGE_LINKS } from "@/constants/routes";
import { useState } from "react";
import { ChartNoAxesColumn } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/empty-state";
import { TruncatedText } from "@/components/truncated-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogCloseButton,
} from "@/components/ui/dialog";
import type { ReportResponse } from "../schemas/reports-schema";

export function ReportSummaryCards({
  data,
}: Readonly<{ data: ReportResponse["dict_bieudo_01"] }>) {
  const [selected, setSelected] = useState<string | null>(null);
  const detail = selected === null ? undefined : data[selected];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {Object.entries(data).map(([label, summary]) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            onClick={() => setSelected(label)}
            className="h-auto min-h-24 min-w-0 flex-col items-start gap-3 p-4 text-left sm:h-auto sm:pointer-coarse:h-auto"
            aria-label={`${label}: ${summary.count} yêu cầu`}
          >
            <TruncatedText
              text={label}
              className="max-w-full shrink-0 text-xs text-muted-foreground"
            />
            <span className="text-2xl font-semibold tabular-nums">
              {new Intl.NumberFormat("vi-VN").format(summary.count)}
            </span>
          </Button>
        ))}
      </div>
      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogHeading
              icon={<ChartNoAxesColumn aria-hidden="true" />}
              title={selected}
              description={`${detail?.count ?? 0} yêu cầu trong khoảng thời gian đã chọn.`}
            />
            <DialogCloseButton />
          </DialogHeader>
          {detail && detail.list_code.length > 0 ? (
            <ul className="space-y-2">
              {detail.list_code.map(([code, id]) => (
                <li key={id}>
                  <Link
                    to={PAGE_LINKS.requestDetail(String(id))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-border px-3 py-2 text-sm text-brand-700 focus-visible:outline-2 focus-visible:outline-ring dark:text-brand-200"
                  >
                    <TruncatedText text={code} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Không có yêu cầu chi tiết"
              className="border-0 shadow-none"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
