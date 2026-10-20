import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import {
  settingsDetailRequest,
  settingsLookupsRequest,
} from "../api/settings-api";
import type { SettingsKind, SettingsRecord } from "../types";
import { settingsConfig } from "../utils/settings-config";

export function useSettingsFormData(
  kind: SettingsKind,
  record?: SettingsRecord,
) {
  const { userId } = useAuthContext();
  const config = settingsConfig[kind];
  const needsDetail = Boolean(record && (config.paginated || kind === "users"));
  const detail = useQuery({
    queryKey: ["settings", kind, userId, "detail", record?.id],
    queryFn: ({ signal }) => settingsDetailRequest(kind, record!.id, signal),
    enabled: needsDetail,
    retry: false,
    staleTime: 0,
  });
  const resources = [
    ...new Set(
      config.fields.flatMap((field) => (field.lookup ? [field.lookup] : [])),
    ),
  ];
  const lookups = useQuery({
    queryKey: ["settings-lookups", userId, resources],
    queryFn: ({ signal }) => settingsLookupsRequest(resources, signal),
    retry: false,
  });
  const loading = (needsDetail && detail.isFetching) || lookups.isPending;
  return {
    detail,
    lookups,
    needsDetail,
    currentRecord: needsDetail ? (detail.data ?? record) : record,
    loading,
    ready: !loading && (!needsDetail || detail.isSuccess) && lookups.isSuccess,
  };
}
