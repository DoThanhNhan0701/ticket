import { useEffect, useState, type ReactNode } from "react";
import { DataResults } from "./data-results";
import type { DataListQuery } from "./types";

const pageSizes = [100, 200] as const;

/** Paginate endpoints that return their complete result set, using the shared list UI. */
export function DataClientResults<T>({
  query,
  scopeKey = "",
  label,
  itemLabel,
  loadingMessage,
  errorPrefix,
  emptyTitle,
  emptyDescription,
  renderRows,
  refreshStyle,
}: Readonly<{
  query: DataListQuery<T>;
  scopeKey?: string;
  label: string;
  itemLabel: string;
  loadingMessage?: string;
  errorPrefix?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  renderRows: (rows: T[], offset: number) => ReactNode;
  refreshStyle?: "overlay" | "subtle";
}>) {
  const [selection, setSelection] = useState({ scopeKey, page: 1 });
  const requestedPage = selection.scopeKey === scopeKey ? selection.page : 1;
  const setPage = (page: number) => setSelection({ scopeKey, page });
  const [pageSize, setPageSize] = useState<number>(pageSizes[0]);
  const rows = query.data?.results ?? [];
  const page = Math.min(
    requestedPage,
    Math.max(1, Math.ceil(rows.length / pageSize)),
  );
  const offset = (page - 1) * pageSize;
  useEffect(() => {
    if (
      selection.scopeKey !== scopeKey ||
      (query.data && !query.isPlaceholderData && selection.page !== page)
    )
      setSelection({ scopeKey, page });
  }, [query.data, query.isPlaceholderData, selection, scopeKey, page]);

  return (
    <DataResults
      refreshStyle={refreshStyle}
      query={{
        ...query,
        data: query.data ? { count: rows.length, results: rows } : undefined,
      }}
      label={label}
      loadingMessage={loadingMessage}
      errorPrefix={errorPrefix}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      pagination={{
        page,
        pageSize,
        pageSizes,
        itemLabel,
        onPage: setPage,
        onPageSize: (size) => {
          setPageSize(size);
          setPage(1);
        },
      }}
      renderRows={() =>
        renderRows(rows.slice(offset, offset + pageSize), offset)
      }
    />
  );
}
