import { format, isValid, parse } from "date-fns";
import type { DataFilterField, DataFilterValues } from "./types";

export function parseListPagination(
  search: URLSearchParams,
  pageSizes: readonly [number, ...number[]],
) {
  const page = Number(search.get("page"));
  const size = Number(search.get("page_size"));
  return {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: pageSizes.find((allowed) => allowed === size) ?? pageSizes[0],
  };
}

export function readStringFilters<Name extends string>(
  search: URLSearchParams,
  names: readonly Name[],
): DataFilterValues<Name> {
  const values: DataFilterValues<Name> = {};
  for (const name of names) {
    const value = search.get(name)?.trim();
    if (value) values[name] = value;
  }
  return values;
}

export function getFilterValues<Name extends string>(
  fields: readonly DataFilterField<Name>[],
  values: DataFilterValues<Name>,
): DataFilterValues<Name> {
  const result: DataFilterValues<Name> = {};
  for (const { name } of fields) result[name] = values[name] ?? "";
  return result;
}

export function countActiveFilters<Name extends string>(
  fields: readonly DataFilterField<Name>[],
  values: DataFilterValues<Name>,
): number {
  return fields.filter(({ name }) => values[name]?.trim()).length;
}

export function normalizeFilterValues<Name extends string>(
  fields: readonly DataFilterField<Name>[],
  values: DataFilterValues<Name>,
): DataFilterValues<Name> {
  const result = getFilterValues(fields, values);
  for (const field of fields) {
    const value = result[field.name]?.trim() ?? "";
    result[field.name] =
      field.type === "date" ? normalizeDateFilter(value) : value;
  }
  return result;
}

function normalizeDateFilter(value: string): string {
  if (!value) return "";
  const inputFormat = value.includes("-") ? "yyyy-MM-dd" : "d/M/yyyy";
  const date = parse(value, inputFormat, new Date());
  return isValid(date) ? format(date, "yyyy-MM-dd") : "";
}

export function updateListSearchParams(
  current: URLSearchParams,
  values: Readonly<Record<string, string | number | undefined>>,
  remove: readonly string[] = [],
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of remove) next.delete(key);
  next.set("page", "1");
  for (const [key, value] of Object.entries(values)) {
    const normalized = value === undefined ? "" : String(value).trim();
    if (normalized) next.set(key, normalized);
    else next.delete(key);
  }
  return next;
}

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function formatDataDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function formatDataDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : `${dateFormat.format(date)} ${timeFormat.format(date)}`;
}
