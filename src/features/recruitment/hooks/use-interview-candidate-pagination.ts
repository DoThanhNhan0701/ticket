import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  parseListPagination,
  updateListSearchParams,
} from "@/components/data-management";
import type { RecruitmentRow } from "../types";

export function useInterviewCandidatePagination(
  rows: RecruitmentRow[],
  query: {
    data?: unknown;
    isPlaceholderData: boolean;
    isSuccess: boolean;
    isFetching: boolean;
  },
) {
  const [params, setParams] = useSearchParams();
  const requested = parseListPagination(params, [100, 200]);
  const page =
    query.data && !query.isPlaceholderData
      ? Math.min(
          requested.page,
          Math.max(1, Math.ceil(rows.length / requested.pageSize)),
        )
      : requested.page;
  useEffect(() => {
    // A pending/placeholder result must not discard a page restored from the URL.
    if (
      query.isSuccess &&
      !query.isFetching &&
      !query.isPlaceholderData &&
      page !== requested.page
    )
      setParams((current) => updateListSearchParams(current, { page }), {
        replace: true,
      });
  }, [
    query.isSuccess,
    query.isFetching,
    query.isPlaceholderData,
    page,
    requested.page,
    setParams,
  ]);
  const update = (values: Record<string, string | number>) =>
    setParams((current) => updateListSearchParams(current, values));
  return {
    page,
    pageSize: requested.pageSize,
    offset: (page - 1) * requested.pageSize,
    update,
  };
}
