import { format, subDays } from "date-fns";
import type { UserPermissions } from "@/features/auth/types";
import type { ReportFilters, ReportGroup } from "../schemas/reports-schema";

export type ReportMode = "dashboard" | "export";

export function getDefaultReportFilters(mode: ReportMode): ReportFilters {
  const today = new Date();
  return {
    startdate: format(
      mode === "dashboard" ? subDays(today, 7) : today,
      "yyyy-MM-dd",
    ),
    enddate: format(today, "yyyy-MM-dd"),
    handlinggroup: "",
    ticket_type_id: "",
  };
}

export function getVisibleReportGroups(
  groups: readonly ReportGroup[],
  userId: number | null,
  permissions: UserPermissions | null,
  mode: ReportMode,
) {
  const canViewAll = mode === "dashboard" || permissions?.can_report_all_groups;
  return groups.filter(
    (group) =>
      group.is_active &&
      (canViewAll || (userId !== null && group.is_manager === userId)),
  );
}

export function getReportFilename(
  mode: ReportMode,
  groupName: string,
  values: ReportFilters,
) {
  const prefix = mode === "dashboard" ? "Bao_cao" : "Du_lieu_yeu_cau";
  return `${prefix}_${groupName}_${values.startdate.split("-").join("")}_${values.enddate.split("-").join("")}.xlsx`;
}
