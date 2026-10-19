import type { DataFilterField } from "@/components/data-management";
import type {
  RequestFilters,
  RequestListScope,
  RequestStatus,
  RequestType,
} from "../types";
import { requestListConfig } from "./request-list-config";

export function getRequestStatusOptions(
  statuses: readonly RequestStatus[],
  selected: string | undefined,
  scope: RequestListScope,
) {
  const options = [
    { value: "all", label: "Tất cả trạng thái" },
    ...statuses
      .filter(
        (status) =>
          !requestListConfig[scope].excludeInitialStatus || status.id !== 1,
      )
      .map((status) => ({
        value: scope === "all" ? String(status.id) : status.name,
        label: status.name,
      })),
  ];
  if (selected && !options.some(({ value }) => value === selected))
    options.push({
      value: selected,
      label: scope === "all" ? `Trạng thái #${selected}` : selected,
    });
  return options;
}

export function getRequestFilterFields(
  scope: RequestListScope,
  types: readonly RequestType[],
  isLoading: boolean,
  selectedType: string | undefined,
): readonly DataFilterField<keyof RequestFilters>[] {
  const fields = requestListConfig[scope].filterFields;
  if (scope !== "all") return fields;
  const options = [
    { value: "", label: "Tất cả loại yêu cầu" },
    ...types.map((type) => ({
      value: String(type.id),
      label: `${type.handling_group_name} - ${type.name}`,
    })),
  ];
  if (selectedType && !options.some(({ value }) => value === selectedType))
    options.push({
      value: selectedType,
      label: `Loại yêu cầu #${selectedType}`,
    });
  return fields.map((field) =>
    field.name === "ticket_type_id" ? { ...field, options, isLoading } : field,
  );
}
