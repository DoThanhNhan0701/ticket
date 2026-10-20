export const settingsKinds = [
  "users",
  "requesting-departments",
  "handling-departments",
  "request-types",
  "teams",
  "positions",
  "offices",
] as const;
export type SettingsKind = (typeof settingsKinds)[number];
export type LookupKind =
  SettingsKind | "position-permissions" | "permission-groups";

export interface SettingsRecord {
  id: number;
  name: string;
  is_active: boolean;
  created?: string;
  updated?: string;
  description?: string | null;
  username?: string;
  first_name?: string | null;
  last_name?: string | null;
  msnv?: string | null;
  email?: string;
  is_superuser?: boolean;
  date_joined?: string;
  date_lock?: string | null;
  last_login?: string | null;
  bophan?: number | null;
  team?: number | null;
  chucvu?: number | null;
  ls_permission?: number[];
  permission?: number[];
  group_email?: string | null;
  is_manager?: number | null;
  username_manager?: string;
  ls_member?: number[];
  handling_group?: number;
  handling_group_name?: string;
  slug_name?: string;
  file_name?: string | null;
  attachment_file?: string | null;
}
export interface SettingsPageData {
  count: number;
  results: SettingsRecord[];
}
export interface SettingsParams {
  page: number;
  pageSize: number;
  search: string;
  status: string;
}
export type SettingsLookups = Partial<Record<LookupKind, SettingsRecord[]>>;
export interface SettingsFormValues {
  name: string;
  username: string;
  first_name: string;
  last_name: string;
  msnv: string;
  email: string;
  bophan: string;
  team: string;
  chucvu: string;
  nhomquyen: string;
  description: string;
  group_email: string;
  is_manager: string;
  ls_member: string[];
  permission: string[];
  handling_group: string;
  is_active: boolean;
}
export type SettingsTextField = Exclude<
  keyof SettingsFormValues,
  "ls_member" | "permission" | "is_active"
>;
export interface SettingsField {
  name: SettingsTextField | "ls_member" | "permission";
  label: string;
  type?: "email" | "textarea" | "select" | "multi";
  lookup?: LookupKind;
  required?: boolean;
  createOnly?: boolean;
  maxLength?: number;
}
export interface SettingsConfig {
  label: string;
  listEndpoint: string;
  writeEndpoint: string;
  paginated: boolean;
  fields: readonly SettingsField[];
  listLookups?: readonly LookupKind[];
}
