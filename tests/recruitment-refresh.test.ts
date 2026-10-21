import {
  QueryClient,
  QueryObserver,
  type QueryKey,
} from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { refreshRecruitmentAction } from "@/features/recruitment/utils/recruitment-refresh";
import type {
  RecruitmentAction,
  RecruitmentEditorState,
} from "@/features/recruitment/types";

const keys = {
  requests: ["recruitment-list", "requests", 42, {}],
  candidates: ["recruitment-list", "candidates", 42, {}],
  requestDetail: ["recruitment-detail", 42, "requests", 85],
  candidateDetail: ["recruitment-detail", 42, "candidates", 408],
  otherDetail: ["recruitment-detail", 42, "candidates", 409],
  notes: ["recruitment-notes", 42, 408],
  otherNotes: ["recruitment-notes", 42, 409],
  interview: ["recruitment-interview-candidates", 42, "PV_TEST", {}],
  otherInterview: ["recruitment-interview-candidates", 42, "PV_OTHER", {}],
  calendar: ["recruitment-calendar", 42, {}],
  report: ["recruitment-report", 42, {}],
  schedules: ["recruitment-attach-interviews", 42, "2026-10-21"],
  lookups: ["recruitment-lookups", 42],
  districts: ["recruitment-districts", 42, "01"],
  interviewStatuses: ["recruitment-interview-statuses", 42],
  reportStatuses: ["recruitment-report-statuses", 42],
  provinces: ["vietnam-address-v2-provinces"],
  wards: ["vietnam-address-v2-wards", "01"],
} satisfies Record<string, QueryKey>;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const clean of cleanups.splice(0).reverse()) clean();
});
function fixture() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  cleanups.push(() => client.clear());
  return client;
}
function observe(client: QueryClient, key: QueryKey) {
  const fetch = vi.fn(async () => ({ updated: true }));
  client.setQueryData(key, { updated: false });
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: fetch,
    staleTime: Infinity,
  });
  cleanups.push(observer.subscribe(() => {}));
  return fetch;
}

it.each<{ action: RecruitmentAction; refreshed: (keyof typeof keys)[] }>([
  { action: "request", refreshed: ["requests", "report"] },
  { action: "create-candidate", refreshed: ["candidates", "report"] },
  {
    action: "candidate",
    refreshed: ["candidates", "interview", "otherInterview", "report"],
  },
  {
    action: "status",
    refreshed: ["candidates", "interview", "otherInterview", "report"],
  },
  {
    action: "delete-candidate",
    refreshed: [
      "candidates",
      "notes",
      "interview",
      "otherInterview",
      "calendar",
      "report",
    ],
  },
  { action: "delete-file", refreshed: ["candidates"] },
  {
    action: "attach",
    refreshed: [
      "candidates",
      "interview",
      "otherInterview",
      "calendar",
      "report",
    ],
  },
  {
    action: "interview",
    refreshed: ["interview", "otherInterview", "calendar"],
  },
  {
    action: "delete-interview",
    refreshed: ["interview", "otherInterview", "calendar"],
  },
  { action: "note", refreshed: ["notes"] },
  { action: "remove-interview-cv", refreshed: ["interview", "calendar"] },
  { action: "candidate-time", refreshed: ["interview"] },
  { action: "duplicate", refreshed: [] },
  { action: "view-candidate", refreshed: [] },
])(
  "refreshes only affected active data once for $action, leaving dictionaries and editors untouched",
  async ({ action, refreshed }) => {
    const client = fixture();
    const calls = Object.fromEntries(
      Object.entries(keys).map(([name, key]) => [name, observe(client, key)]),
    );
    const otherUserCalls = Object.values(keys)
      .filter((key) => String(key[0]).startsWith("recruitment"))
      .map((key) => {
        const other = [...key];
        other[key[0] === "recruitment-list" ? 2 : 1] = 99;
        return observe(client, other);
      });
    const state: RecruitmentEditorState = {
      action,
      row: { id: action === "request" ? 85 : 408 },
      code: "PV_TEST",
    };
    await refreshRecruitmentAction(client, state, 42);
    for (const [name, call] of Object.entries(calls))
      expect(call, name).toHaveBeenCalledTimes(
        refreshed.includes(name as keyof typeof keys) ? 1 : 0,
      );
    for (const call of otherUserCalls) expect(call).not.toHaveBeenCalled();
    expect(client.getQueryState(keys.lookups)?.isInvalidated).toBe(false);
    expect(client.getQueryState(keys.districts)?.isInvalidated).toBe(false);
  },
);

it("marks related inactive pages and profile details stale without fetching until they are revisited", async () => {
  const client = fixture();
  client.setQueryData(keys.report, { previous: true });
  const detailFetch = observe(client, keys.candidateDetail);
  const lookupFetch = observe(client, keys.lookups);
  await refreshRecruitmentAction(
    client,
    { action: "candidate", row: { id: 408 } },
    42,
  );
  expect(client.getQueryState(keys.report)?.isInvalidated).toBe(true);
  expect(client.getQueryState(keys.candidateDetail)?.isInvalidated).toBe(true);
  expect(detailFetch).not.toHaveBeenCalled();
  expect(lookupFetch).not.toHaveBeenCalled();
  const visit = vi.fn(async () => ({ updated: true }));
  await client.fetchQuery({
    queryKey: keys.report,
    queryFn: visit,
    staleTime: Infinity,
  });
  expect(visit).toHaveBeenCalledTimes(1);
});

it("marks every selected profile stale after bulk scheduling without refetching open editors", async () => {
  const client = fixture();
  const first = observe(client, keys.candidateDetail);
  const second = observe(client, keys.otherDetail);
  const unrelatedKey = ["recruitment-detail", 42, "candidates", 410];
  const unrelated = observe(client, unrelatedKey);
  const schedules = observe(client, keys.schedules);
  await refreshRecruitmentAction(
    client,
    { action: "attach", row: {}, ids: [408, 409] },
    42,
  );
  expect(client.getQueryState(keys.candidateDetail)?.isInvalidated).toBe(true);
  expect(client.getQueryState(keys.otherDetail)?.isInvalidated).toBe(true);
  expect(client.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
  expect(client.getQueryState(keys.schedules)?.isInvalidated).toBe(true);
  for (const fetch of [first, second, unrelated, schedules])
    expect(fetch).not.toHaveBeenCalled();
});
