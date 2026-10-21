import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { RecruitmentAction, RecruitmentEditorState } from "../types";

type Scope =
  | "requests"
  | "candidates"
  | "candidate-detail"
  | "request-detail"
  | "interviews"
  | "calendar"
  | "reports"
  | "notes"
  | "duplicates"
  | "schedules";
const scopes: Partial<Record<RecruitmentAction, readonly Scope[]>> = {
  request: ["requests", "request-detail", "reports"],
  "create-candidate": ["candidates", "reports", "duplicates"],
  candidate: [
    "candidates",
    "candidate-detail",
    "interviews",
    "reports",
    "duplicates",
  ],
  status: ["candidates", "candidate-detail", "interviews", "reports"],
  "delete-candidate": [
    "candidates",
    "candidate-detail",
    "interviews",
    "notes",
    "reports",
    "duplicates",
    "calendar",
    "schedules",
  ],
  "delete-file": ["candidates", "candidate-detail"],
  attach: [
    "candidates",
    "candidate-detail",
    "interviews",
    "calendar",
    "reports",
    "schedules",
  ],
  interview: ["calendar", "interviews", "schedules"],
  "delete-interview": ["calendar", "interviews", "schedules"],
  note: ["notes"],
  "remove-interview-cv": ["interviews", "calendar", "schedules"],
  "candidate-time": ["interviews"],
};

function affectedProfile(state: RecruitmentEditorState, id: unknown) {
  return (state.ids ?? [state.row.id]).includes(id as number);
}

export function recruitmentQueryAffected(
  key: QueryKey,
  state: RecruitmentEditorState,
  userId: number | null,
) {
  const affected = scopes[state.action] ?? [];
  if (key[0] === "recruitment-list")
    return key[2] === userId && affected.includes(key[1] as Scope);
  if (key[1] !== userId) return false;
  switch (key[0]) {
    case "recruitment-detail":
      return (
        affectedProfile(state, key[3]) &&
        ((key[2] === "candidates" && affected.includes("candidate-detail")) ||
          (key[2] === "requests" && affected.includes("request-detail")))
      );
    case "recruitment-notes":
      return affected.includes("notes") && key[2] === state.row.id;
    case "recruitment-interview-candidates":
      return (
        affected.includes("interviews") &&
        (!["candidate-time", "remove-interview-cv"].includes(state.action) ||
          !state.code ||
          key[2] === state.code)
      );
    case "recruitment-calendar":
      return affected.includes("calendar");
    case "recruitment-report":
      return affected.includes("reports");
    case "recruitment-duplicate":
      return affected.includes("duplicates");
    case "recruitment-attach-interviews":
      return affected.includes("schedules");
    default:
      return false;
  }
}

const backgroundQueries = new Set([
  "recruitment-list",
  "recruitment-calendar",
  "recruitment-interview-candidates",
  "recruitment-report",
  "recruitment-notes",
]);

export async function refreshRecruitmentAction(
  client: QueryClient,
  state: RecruitmentEditorState,
  userId: number | null,
) {
  // Mark related inactive pages/details stale for their next visit. Do not
  // refetch the open editor or its dictionaries while the save is settling.
  await client.invalidateQueries({
    predicate: (query) =>
      recruitmentQueryAffected(query.queryKey, state, userId),
    refetchType: "none",
  });
  await client.refetchQueries({
    type: "active",
    predicate: (query) =>
      backgroundQueries.has(String(query.queryKey[0])) &&
      recruitmentQueryAffected(query.queryKey, state, userId),
  });
}
