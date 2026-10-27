import { t, useLocale } from "@/i18n";
import { PAGE_LINKS } from "@/constants/routes";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { localizedToast as toast } from "@/i18n/toast";
import { AsyncButton } from "@/components/ui/async-button";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { getCreateRequestTypes } from "../api/create-request-api";
import type { RequestDetailData } from "../schemas/request-detail-schema";

export function TicketCloneButton({
  ticket,
}: Readonly<{ ticket: RequestDetailData }>) {
  useLocale();
  const { permissions } = useAuthContext();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: async () => {
      const types = await getCreateRequestTypes(String(ticket.handling_group));
      if (!types.some((type) => type.id === ticket.ticket_type))
        throw new Error(
          t(
            "request-create",
            "Loại yêu cầu đã bị vô hiệu hóa hoặc không còn tồn tại. Không thể sao chép yêu cầu này.",
          ),
        );
    },
    onSuccess: () => {
      void navigate(PAGE_LINKS.cloneRequest(ticket.id));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  if (!permissions?.can_create) return null;
  return (
    <div className="min-w-0 space-y-2">
      <AsyncButton
        type="button"
        variant="outline"
        size="sm"
        mobileIconOnly
        className="border-slate-400 bg-slate-200 font-semibold text-slate-900 hover:border-slate-500 hover:bg-slate-300 hover:text-slate-950 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:border-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-50"
        title={t("request-create", "Sao chép")}
        loading={mutation.isPending}
        icon={<Copy className="size-4" />}
        onClick={() => {
          if (!mutation.isPending) mutation.mutate();
        }}
      >
        {t("request-create", "Sao chép")}
      </AsyncButton>
    </div>
  );
}
