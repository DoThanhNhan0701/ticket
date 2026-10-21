import { Badge } from "@/components/ui/badge";
import { recruitmentText } from "../utils/recruitment-format";

const statusColors: Record<string, string> = {
  "chờ duyệt":
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  "chờ phỏng vấn":
    "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  "chờ kết quả":
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  "không đạt": "border-danger-border bg-danger-soft text-destructive",
  đạt: "border-success-border bg-success-soft text-success",
  "tiềm năng":
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  offer: "border-warning-border bg-warning-soft text-warning",
  "không nhận việc": "border-border bg-muted text-muted-foreground",
  "đã nhận việc":
    "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300",
};

export function RecruitmentStatusBadge({
  status,
}: Readonly<{ status: unknown }>) {
  const label = recruitmentText(status).trim();
  return (
    <Badge className={statusColors[label.toLocaleLowerCase("vi-VN")]}>
      {label || "—"}
    </Badge>
  );
}
