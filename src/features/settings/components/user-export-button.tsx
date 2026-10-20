import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { AsyncButton } from "@/components/ui/async-button";
import { getRequest } from "@/lib/api/client";
import { downloadFile } from "@/lib/download";
import { parseSpreadsheet } from "@/lib/api/spreadsheet";

export function UserExportButton({
  icon: Icon,
}: Readonly<{ icon: LucideIcon }>) {
  const exporting = useRef(false);
  const mutation = useMutation({
    mutationFn: async () =>
      parseSpreadsheet(
        await getRequest<unknown>("/export_user", { responseType: "blob" }),
      ),
    retry: false,
    onSuccess: (file) => downloadFile(file, "Nguoi_dung.xlsx"),
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      exporting.current = false;
    },
  });
  return (
    <AsyncButton
      variant="outline"
      aria-label={mutation.isPending ? "Đang xuất..." : "Xuất Excel"}
      title="Xuất Excel"
      className="w-11 px-0 lg:w-auto lg:px-4"
      loading={mutation.isPending}
      loadingText={<span className="hidden lg:inline">Đang xuất...</span>}
      icon={<Icon className="size-4" aria-hidden="true" />}
      onClick={() => {
        if (!exporting.current) {
          exporting.current = true;
          mutation.mutate();
        }
      }}
    >
      <span className="hidden lg:inline">Xuất Excel</span>
    </AsyncButton>
  );
}
