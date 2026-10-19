import {
  CalendarCheck,
  FileSignature,
  Fingerprint,
  FolderOpen,
  Grid,
  LineChart,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

const iconRules: ReadonlyArray<{
  keywords: readonly string[];
  icon: LucideIcon;
}> = [
  { keywords: ["calendar", "ticket"], icon: CalendarCheck },
  { keywords: ["fingerprint", "chấm công", "hr"], icon: Fingerprint },
  { keywords: ["container", "document", "tài liệu", "doc"], icon: FolderOpen },
  {
    keywords: ["signature", "file", "chi phí", "tài sản"],
    icon: FileSignature,
  },
  { keywords: ["chart", "revenue", "doanh thu", "dt", "cp"], icon: LineChart },
  { keywords: ["comment", "talk", "chat", "rtalk"], icon: MessageSquare },
];

export function getProjectIcon(iconName: string, projectName: string) {
  const name = (iconName || projectName).toLowerCase();
  return (
    iconRules.find(({ keywords }) =>
      keywords.some((keyword) => name.includes(keyword)),
    )?.icon ?? Grid
  );
}
