import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import type { TemplateGroup } from "@/features/settings/schemas/template-schema";
import type { CreateRequestValues } from "../schemas/create-request-schema";
import { getRequestDetail, validTicketId } from "../api/request-detail-api";
import type { CreateRequestLookups } from "../api/create-request-api";
import { detailFields, emptyDetailRow } from "../utils/request-detail-data";
import { fieldDataKey } from "../utils/ticket-detail";

export function useCloneRequest({
  userId,
  restored = false,
  form,
  lookups,
  types,
  selectedType,
  groups,
  templateReady,
}: {
  userId: number | null;
  restored?: boolean;
  form: UseFormReturn<CreateRequestValues>;
  lookups?: CreateRequestLookups;
  types?: { id: number }[];
  selectedType?: { id: number };
  groups: TemplateGroup[];
  templateReady: boolean;
}) {
  const [params] = useSearchParams();
  const id = params.get("clone");
  const stage = useRef(restored ? 3 : 0);
  const [initialized, setInitialized] = useState(restored);
  const source = useQuery({
    queryKey: ["request-clone", userId, id],
    queryFn: ({ signal }) => getRequestDetail(id!, signal),
    enabled: Boolean(!restored && id && validTicketId(id)),
    retry: false,
    refetchOnReconnect: true,
  });
  const ticket = source.data;
  const unavailable =
    !initialized &&
    (Boolean(
      ticket &&
      lookups &&
      !lookups.groups.some((group) => group.id === ticket.handling_group),
    ) ||
      Boolean(
        ticket &&
        types &&
        !types.some((type) => type.id === ticket.ticket_type),
      ));
  useEffect(() => {
    if (!ticket || !lookups || unavailable || stage.current !== 0) return;
    const pick = (id: number | null | undefined, options: { id: number }[]) =>
      options.some((option) => option.id === id) ? String(id) : "";
    form.reset({
      ...form.getValues(),
      title: ticket.title,
      description: ticket.description,
      handling_group: String(ticket.handling_group),
      ticket_type: "",
      approve_user: pick(ticket.approve_user, lookups.approvers),
      fore_cus: pick(ticket.fore_cus, lookups.customers),
      bophansudung: pick(ticket.bophansudung, lookups.departments),
      vanphong: pick(ticket.vanphong, lookups.offices),
      other1: ticket.other1
        .split(",")
        .map((value) => value.trim())
        .filter((id) => lookups.teams.some((team) => String(team.id) === id)),
    });
    stage.current = 1;
  }, [ticket, lookups, unavailable, form]);
  useEffect(() => {
    if (!ticket || !types || unavailable || stage.current !== 1) return;
    form.setValue("ticket_type", String(ticket.ticket_type));
    stage.current = 2;
  }, [ticket, types, unavailable, form]);
  useEffect(() => {
    if (
      !ticket ||
      !templateReady ||
      selectedType?.id !== ticket.ticket_type ||
      stage.current !== 2
    )
      return;
    const sourceFields =
      ticket.data_item?.dataform.header.flatMap((group) => group.children) ??
      [];
    const records = ticket.data_item?.dataform.data ?? [];
    form.setValue(
      "rows",
      records.length && groups.length
        ? records.map((record) => {
            const row = emptyDetailRow(groups);
            for (const field of detailFields(groups)) {
              const original = sourceFields.find(
                (source) => source.title === field.title,
              );
              const value = String(
                record[original ? fieldDataKey(original) : field.title] ?? "",
              );
              if (field.type === "range-date-text" && !field.option?.length) {
                const [start = "", end = ""] = value.split(" - ");
                row.values[`${field.fieldKey}_start`] = start;
                row.values[`${field.fieldKey}_end`] = end;
              } else row.values[field.fieldKey] = value;
            }
            return row;
          })
        : [emptyDetailRow(groups)],
    );
    stage.current = 3;
    setInitialized(true);
  }, [ticket, templateReady, selectedType, groups, form]);
  let error = source.error?.message;
  if (id && !validTicketId(id)) error = "Mã yêu cầu sao chép không hợp lệ.";
  else if (unavailable)
    error = "Bộ phận hoặc loại yêu cầu đã bị vô hiệu hóa. Không thể sao chép.";
  return {
    id,
    ready: !id || initialized,
    error,
    loading: Boolean(id && !initialized && !error),
    canRetry: source.isError,
    retry: () => void source.refetch(),
  };
}
