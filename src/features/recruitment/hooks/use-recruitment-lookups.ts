import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { recruitmentLookups } from "../api/recruitment-api";
export function useRecruitmentLookups(enabled = true) {
  const { userId } = useAuthContext();
  return useQuery({
    queryKey: ["recruitment-lookups", userId],
    queryFn: ({ signal }) => recruitmentLookups(signal),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}
