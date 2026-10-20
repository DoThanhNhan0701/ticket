import type { ReactNode } from "react";

export interface DataColumn<T> {
  readonly id: string;
  readonly label: string;
  readonly width?: string;
  readonly align?: "left" | "center" | "right";
  readonly sticky?: "right";
  readonly className?: string;
  readonly render: (row: T, index: number) => ReactNode;
}

export interface DataFilterField<Name extends string = string> {
  readonly name: Name;
  readonly label: string;
  readonly placeholder: string;
  readonly type?: "text" | "date" | "select" | "multi-select";
  readonly options?: readonly { value: string; label: string }[];
  readonly isLoading?: boolean;
  readonly searchable?: boolean;
}

export type DataFilterValues<Name extends string = string> = Partial<
  Record<Name, string>
>;

export interface DataPaginationProps {
  readonly count: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageSizes: readonly number[];
  readonly itemLabel?: string;
  readonly disabled?: boolean;
  readonly onPage: (page: number) => void;
  readonly onPageSize: (size: number) => void;
}

export interface DataListQuery<T> {
  readonly data?: { readonly count: number; readonly results: T[] };
  readonly error: Error | null;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isPlaceholderData: boolean;
  readonly refetch: () => unknown;
}
