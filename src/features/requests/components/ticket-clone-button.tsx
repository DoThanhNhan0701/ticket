import { PAGE_LINKS } from "@/constants/routes";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { AsyncButton } from "@/components/ui/async-button";
import { ErrorAlert } from "@/components/error-alert";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { getCreateRequestTypes } from "../api/create-request-api";
import type { RequestDetailData } from "../schemas/request-detail-schema";

export function TicketCloneButton({
  ticket,
}: Readonly<{ ticket: RequestDetailData }>) {
  const { permissions } = useAuthContext();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: async () => {
      const types = await getCreateRequestTypes(String(ticket.handling_group));
      if (!types.some((type) => type.id === ticket.ticket_type))
        throw new Error(
          "Loại yêu cầu đã bị vô hiệu hóa hoặc không còn tồn tại. Không thể sao chép yêu cầu này.",
        );
    },
    onSuccess: () => {
      void navigate(PAGE_LINKS.cloneRequest(ticket.id));
    },
  });
  if (!permissions?.can_create) return null;
  return (
    <div className="min-w-0 space-y-2">
      <AsyncButton
        type="button"
        variant="outline"
        size="sm"
        loading={mutation.isPending}
        icon={<Copy className="size-4" />}
        onClick={() => {
          if (!mutation.isPending) mutation.mutate();
        }}
      >
        Sao chép
      </AsyncButton>
      {mutation.isError && <ErrorAlert message={mutation.error.message} />}
    </div>
  );
}
