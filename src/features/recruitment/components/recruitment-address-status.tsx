import { ErrorToast } from "@/components/error-toast";
import { Button } from "@/components/ui/button";
import type { useRecruitmentAddress } from "../hooks/use-recruitment-address";

export function RecruitmentAddressStatus({
  address,
  disabled,
  readonly,
}: Readonly<{
  address: ReturnType<typeof useRecruitmentAddress>;
  disabled: boolean;
  readonly: boolean;
}>) {
  if (!address.enabled) return null;
  return (
    <>
      {address.legacy && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <p>Hồ sơ đang sử dụng địa chỉ tỉnh, quận/huyện cũ.</p>
          {!readonly && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={address.upgrade}
            >
              Chọn địa chỉ mới
            </Button>
          )}
        </div>
      )}
      {address.queries.some((query) => query.isError) && (
        <ErrorToast message="Không tải được danh mục địa chỉ. Vui lòng thử lại." />
      )}
    </>
  );
}
