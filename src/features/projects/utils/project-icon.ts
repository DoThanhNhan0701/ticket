import {
  CalendarCheck,
  FileSignature,
  Fingerprint,
  FolderOpen,
  Grid,
  LineChart,
  MessageSquare,
} from "lucide-react";

export function getProjectIcon(iconName: string, projectName: string) {
  const name = (iconName || projectName).toLowerCase();
  if (name.includes("calendar") || name.includes("ticket"))
    return CalendarCheck;
  if (
    name.includes("fingerprint") ||
    name.includes("chấm công") ||
    name.includes("hr")
  )
    return Fingerprint;
  if (
    name.includes("container") ||
    name.includes("document") ||
    name.includes("tài liệu") ||
    name.includes("doc")
  )
    return FolderOpen;
  if (
    name.includes("signature") ||
    name.includes("file") ||
    name.includes("chi phí") ||
    name.includes("tài sản")
  )
    return FileSignature;
  if (
    name.includes("chart") ||
    name.includes("revenue") ||
    name.includes("doanh thu") ||
    name.includes("dt") ||
    name.includes("cp")
  )
    return LineChart;
  if (
    name.includes("comment") ||
    name.includes("talk") ||
    name.includes("chat") ||
    name.includes("rtalk")
  )
    return MessageSquare;
  return Grid;
}
