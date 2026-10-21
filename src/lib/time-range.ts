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
  if (time === undefined) return "Giờ không hợp lệ. Vui lòng nhập HH:mm.";
  const min = timeMinutes(minTime);
  const max = timeMinutes(maxTime);
  if (min !== undefined && max !== undefined && min > max)
    return "Khung giờ phỏng vấn không hợp lệ.";
  if ((min === undefined || time >= min) && (max === undefined || time <= max))
    return null;
  if (min !== undefined && max !== undefined)
    return `Giờ phải nằm trong khoảng ${minTime} đến ${maxTime}.`;
  if (min !== undefined) return `Giờ phải từ ${minTime} trở đi.`;
  return `Giờ không được sau ${maxTime}.`;
}
