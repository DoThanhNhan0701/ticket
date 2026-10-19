import type { Key, MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TruncatedText } from "@/components/truncated-text";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DataColumn } from "./types";

const alignClasses = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function canNavigateRow(event: MouseEvent<HTMLTableRowElement>): boolean {
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (event.target instanceof Element &&
      event.target.closest(
        'a, button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="combobox"], [contenteditable="true"]',
      ))
  );
}

export function DataText({ text }: Readonly<{ text?: string | null }>) {
  return <TruncatedText text={text || "—"} lines={2} />;
}

export function DataRowLink({
  to,
  text,
  className,
}: Readonly<{ to: string; text?: string | null; className?: string }>) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded font-medium focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      <DataText text={text} />
    </Link>
  );
}

export function DataTable<T>({
  rows,
  columns,
  label,
  scrollLabel,
  getRowKey,
  getRowHref,
  className,
}: Readonly<{
  rows: readonly T[];
  columns: readonly DataColumn<T>[];
  label: string;
  scrollLabel: string;
  getRowKey: (row: T) => Key;
  getRowHref?: (row: T) => string;
  className?: string;
}>) {
  const navigate = useNavigate();
  return (
    <Table
      aria-label={label}
      className={cn(
        "table-fixed [&_td]:px-3 [&_td]:py-3 [&_td]:align-middle",
        className,
      )}
      wrapperClassName="min-h-0 flex-1 overscroll-contain rounded-t-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      scrollRegionLabel={scrollLabel}
    >
      <colgroup>
        {columns.map((column) => (
          <col key={column.id} style={{ width: column.width }} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.id}
              scope="col"
              className={cn(
                "px-3 py-3 align-middle",
                alignClasses[column.align ?? "left"],
              )}
            >
              <TruncatedText text={column.label} />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const path = getRowHref?.(row);
          return (
            <TableRow
              key={getRowKey(row)}
              className={cn(
                "h-18",
                path &&
                  "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              )}
              tabIndex={path ? 0 : undefined}
              onClick={
                path
                  ? (event) => {
                      if (canNavigateRow(event)) navigate(path);
                    }
                  : undefined
              }
              onKeyDown={
                path
                  ? (event) => {
                      if (
                        event.target === event.currentTarget &&
                        event.key === "Enter"
                      ) {
                        event.preventDefault();
                        navigate(path);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(
                    alignClasses[column.align ?? "left"],
                    column.className,
                  )}
                >
                  {column.render(row, index)}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
