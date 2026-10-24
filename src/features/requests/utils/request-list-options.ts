import { t } from "@/i18n";
import type { DataFilterField } from "@/components/data-management";
import type {
  RequestFilters,
  RequestListScope,
  RequestStatus,
  RequestType,
  RequestTeam,
} from "../types";
import { requestListConfig } from "./request-list-config";

export function getRequestStatusOptions(
  statuses: readonly RequestStatus[],
  selected: string | undefined,
  scope: RequestListScope,
) {
  const usesStatusIds = requestListConfig[scope].statusKey === "ticket_status";
  const options = [
    { value: "all", label: t("request-list", "Tất cả trạng thái") },
    ...statuses
      .filter(
        (status) =>
          !requestListConfig[scope].excludeInitialStatus || status.id !== 1,
      )
      .map((status) => ({
        value: usesStatusIds ? String(status.id) : status.name,
        label: t("statuses", status.name),
      })),
  ];
  if (selected && !options.some(({ value }) => value === selected))
    options.push({
      value: selected,
      label: usesStatusIds
        ? t("request-list", "Trạng thái #{0}", [selected])
        : t("statuses", selected),
    });
  return options;
}

export function getRequestFilterFields(
  scope: RequestListScope,
  {
    types,
    typesLoading,
    selectedType,
    teams,
    teamsLoading,
    selectedTeams,
  }: Readonly<{
    types: readonly RequestType[];
    typesLoading: boolean;
    selectedType?: string;
    teams: readonly RequestTeam[];
    teamsLoading: boolean;
    selectedTeams?: string;
  }>,
): readonly DataFilterField<keyof RequestFilters>[] {
  const config = requestListConfig[scope];
  const fields = config.filterFields;
  if (!config.typeSource) return fields;
  const typeOptions = getTypeOptions(types, config.typeValue, selectedType);
  const teamOptions = teams.map(({ id, name }) => ({
    value: String(id),
    label: name,
  }));
  for (const id of selectedTeams?.split(",") ?? []) {
    if (!teamOptions.some(({ value }) => value === id))
      teamOptions.push({ value: id, label: `Team #${id}` });
  }
  return fields.map((field) => {
    if (field.name === "ticket_type_id" || field.name === "ticket_type_name")
      return { ...field, options: typeOptions, isLoading: typesLoading };
    if (field.name === "team_id")
      return { ...field, options: teamOptions, isLoading: teamsLoading };
    return field;
  });
}

function getTypeOptions(
  types: readonly RequestType[],
  valueType: "id" | "name" | undefined,
  selectedType: string | undefined,
) {
  const options = [
    { value: "", label: t("request-list", "Tất cả loại yêu cầu") },
    ...types.map((type) => ({
      value: valueType === "name" ? type.name : String(type.id),
      label: `${type.handling_group_name} - ${type.name}`,
    })),
  ];
  if (selectedType && !options.some(({ value }) => value === selectedType))
    options.push({
      value: selectedType,
      label:
        valueType === "name"
          ? selectedType
          : t("request-list", "Loại yêu cầu #{0}", [selectedType]),
    });
  return [...new Map(options.map((option) => [option.value, option])).values()];
}
