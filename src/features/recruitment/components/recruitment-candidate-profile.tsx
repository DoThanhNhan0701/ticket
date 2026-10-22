import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { Paperclip } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { formatDataDate } from "@/components/data-management";
import { TicketFiles } from "@/features/requests/components/ticket-files";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import type { RecruitmentLookups, RecruitmentRow } from "../types";
import {
  listVietnamProvinces,
  listVietnamWards,
} from "../api/vietnam-address-api";
import { recruitmentArray } from "../api/recruitment-api";
import {
  recruitmentFileHref,
  recruitmentStoredDate,
  recruitmentText,
  recruitmentOptions,
} from "../utils/recruitment-format";

export function RecruitmentCandidateProfile({
  row,
  lookups,
  onClose,
}: Readonly<{
  row: RecruitmentRow;
  lookups: RecruitmentLookups;
  onClose: () => void;
}>) {
  const { userId } = useAuthContext();
  const city = recruitmentText(row.city_code);
  const district = recruitmentText(row.district_code);
  const legacy = !/^\d{5}$/.test(district);
  const provinces = useQuery({
    queryKey: ["vietnam-address-v2-provinces"],
    queryFn: ({ signal }) => listVietnamProvinces(signal),
    enabled: Boolean(city && !row.city_name && !legacy),
    staleTime: 86400000,
    retry: false,
  });
  const districts = useQuery({
    queryKey: legacy
      ? ["recruitment-districts", userId, city]
      : ["vietnam-address-v2-wards", city],
    queryFn: ({ signal }) =>
      legacy
        ? recruitmentArray(
            API_ENDPOINTS.recruitment.districts,
            { city_code: city },
            signal,
          ).then((rows) => recruitmentOptions(rows, "code"))
        : listVietnamWards(city, signal),
    enabled: Boolean(city && district && !row.district_name),
    staleTime: legacy ? 60000 : 86400000,
    retry: false,
  });
  const fields = [
    ["Mã CV", row.code_cv],
    ["Họ và tên", row.first_name],
    ["Ngày sinh", formatDataDate(recruitmentStoredDate(row.birthday))],
    ["Giới tính", row.gender],
    ["Số điện thoại", row.numberphone],
    ["Email", row.email],
    [
      "Tỉnh/Thành phố",
      row.city_name ||
        (provinces.data ?? lookups.cities ?? []).find(
          (option) => option.value === city,
        )?.label,
    ],
    [
      legacy ? "Quận/Huyện" : "Xã/Phường/Đặc khu",
      row.district_name ||
        districts.data?.find((option) => option.value === district)?.label,
    ],
    ["Địa chỉ", row.address],
    ["Trình độ học vấn", row.education_level_name],
    ["Chuyên ngành", row.education_major],
    ["Trình độ ngoại ngữ", row.language_skill],
    [
      "Ngày ứng tuyển",
      formatDataDate(recruitmentStoredDate(row.application_date)),
    ],
  ]
    .map(([label, value]) => [String(label), recruitmentText(value).trim()])
    .filter(([, value]) => value);
  const cv = recruitmentFileHref(row.path_file_cv, row.name_file_cv);
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0 space-y-1">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium whitespace-pre-wrap wrap-anywhere">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {cv && (
        <section aria-label="Tệp CV" className="space-y-2 border-t pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Paperclip aria-hidden="true" className="size-4" />
            Tệp CV
          </h3>
          <TicketFiles
            previewAllFiles
            layout="tiles"
            files={{ [recruitmentText(row.name_file_cv) || "Tệp CV"]: cv }}
          />
        </section>
      )}
      <DialogFooter className="mt-0 pt-0">
        <Button type="button" variant="outline" onClick={onClose}>
          Đóng
        </Button>
      </DialogFooter>
    </div>
  );
}
