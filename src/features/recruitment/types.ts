export type RecruitmentKind = "requests" | "candidates";
export interface RecruitmentRow {
  id?: number;
  [key: string]: unknown;
}
export interface RecruitmentListData {
  count: number;
  results: RecruitmentRow[];
}
export interface RecruitmentOption {
  value: string;
  label: string;
}
export type RecruitmentLookups = Record<string, RecruitmentOption[]>;
export interface RecruitmentField {
  name: string;
  label: string;
  type?: "date" | "time" | "select" | "multi" | "textarea" | "email" | "number";
  lookup?: string;
  required?: boolean;
  readonly?: boolean;
  min?: number;
  max?: number;
}
export type RecruitmentValues = Record<string, string | string[]>;
export type RecruitmentAction =
  | "request"
  | "candidate"
  | "view-candidate"
  | "create-candidate"
  | "status"
  | "duplicate"
  | "delete-candidate"
  | "delete-file"
  | "attach"
  | "interview"
  | "delete-interview"
  | "note"
  | "remove-interview-cv"
  | "candidate-time";
export interface RecruitmentEditorState {
  action: RecruitmentAction;
  row: RecruitmentRow;
  ids?: number[];
  code?: string;
}
