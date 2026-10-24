import { t, useLocale } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { recruitmentLookups } from "../api/recruitment-api";
import type { RecruitmentLookups } from "../types";
export function useRecruitmentLookups(enabled = true) {
  useLocale();
  const { userId } = useAuthContext();
  return useQuery({
    queryKey: ["recruitment-lookups", userId],
    queryFn: ({ signal }) => recruitmentLookups(signal),
    select: (data): RecruitmentLookups => ({
      ...data,
      statuses: (data.statuses ?? []).map((option) => ({
        ...option,
        label: t("statuses", option.label),
      })),
    }),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}
