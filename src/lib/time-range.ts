import { t } from "@/i18n";
export function timeMinutes(value?: string): number | undefined {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function validateTimeRange(
  value: string,
  minTime?: string,
  maxTime?: string,
): string | null {
  if (!value) return null;
  const time = timeMinutes(value);
  if (time === undefined)
    return t("common", "Giờ không hợp lệ. Vui lòng nhập HH:mm.");
  const min = timeMinutes(minTime);
  const max = timeMinutes(maxTime);
  if (min !== undefined && max !== undefined && min > max)
    return t("common", "Khung giờ phỏng vấn không hợp lệ.");
  if ((min === undefined || time >= min) && (max === undefined || time <= max))
    return null;
  if (min !== undefined && max !== undefined)
    return t("common", "Giờ phải nằm trong khoảng {0} đến {1}.", [
      minTime,
      maxTime,
    ]);
  if (min !== undefined)
    return t("common", "Giờ phải từ {0} trở đi.", [minTime]);
  return t("common", "Giờ không được sau {0}.", [maxTime]);
}
