import { t, useLocale } from "@/i18n";
import { ErrorToast } from "@/components/error-toast";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Save, X } from "lucide-react";
import { localizedToast as toast } from "@/i18n/toast";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TruncatedText } from "@/components/truncated-text";
import type { TemplateField } from "@/features/settings/schemas/template-schema";
import type { RequestDetailData } from "../schemas/request-detail-schema";
import type { CreateRequestValues } from "../schemas/create-request-schema";
import { detailFields, validateDetailRows } from "../utils/request-detail-data";
import {
  canEditTicketField,
  canViewTicketField,
  sectionUpdateRows,
  ticketDetailRows,
  ticketFieldRoles,
} from "../utils/ticket-detail";
import { updateTicketSection } from "../api/request-detail-api";
import { RequestDetailField } from "./request-detail-field";
import { RequestFormSection } from "./request-form-section";

export function TicketTemplate({
  ticket,
  onSaved,
}: Readonly<{ ticket: RequestDetailData; onSaved: () => Promise<unknown> }>) {
  useLocale();
  const { username, userId } = useAuthContext();
  const { creator, processor, editingProcessor } = ticketFieldRoles(ticket, {
    username,
    userId,
  });
  const groups = ticket.data_item?.dataform.header ?? [];
  const fields = detailFields(groups);
  const mayEditField = (field: TemplateField) =>
    canViewTicketField(field, { creator, processor }) &&
    canEditTicketField(field, { creator, processor: editingProcessor });
  const mayEditSection = (section: number) =>
    [2, 3, 6].includes(ticket.ticket_status) &&
    groups[section]?.editable === false &&
    Boolean(ticket.data_item?.dataform.data.length) &&
    fields.some((field) => field.groupIndex === section && mayEditField(field));
  const [editing, setEditing] = useState<number | null>(null);
  const editingAllowed = editing !== null && mayEditSection(editing);
  useEffect(() => {
    if (editing !== null && !editingAllowed) setEditing(null);
  }, [editing, editingAllowed]);
  const form = useForm<CreateRequestValues>({
    defaultValues: { rows: ticketDetailRows(ticket) },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });
  const mutation = useMutation({
    mutationFn: async (section: number) => {
      if (!mayEditSection(section))
        throw new Error(
          t("request-detail", "Bạn không còn quyền chỉnh sửa phần này."),
        );
      await updateTicketSection(
        ticket.id,
        groups[section],
        sectionUpdateRows(
          ticket,
          section,
          form.getValues("rows"),
          mayEditField,
        ),
      );
    },
    onSuccess: async () => {
      setEditing(null);
      toast.success(t("request-detail", "Đã lưu chi tiết yêu cầu."));
      try {
        await onSaved();
      } catch {
        toast.error(
          t("request-detail", "Đã lưu chi tiết. Vui lòng tải lại yêu cầu."),
        );
      }
    },
  });
  const save = (section: number) => {
    if (mutation.isPending || !mayEditSection(section)) return;
    form.clearErrors();
    const allowed = fields.filter(
      (field) => field.groupIndex === section && mayEditField(field),
    );
    const keys = new Set(
      allowed.flatMap((field) => [
        field.fieldKey,
        `${field.fieldKey}_start`,
        `${field.fieldKey}_end`,
      ]),
    );
    const errors = validateDetailRows(groups, form.getValues("rows")).filter(
      (issue) => keys.has(String(issue.path[issue.path.length - 1])),
    );
    for (const issue of errors)
      form.setError(issue.path.join(".") as `rows.${number}.values.${string}`, {
        type: "custom",
        message: issue.message,
      });
    if (errors.length) return;
    mutation.mutate(section);
  };
  return (
    <RequestFormSection
      title={t("request-detail", "Chi tiết yêu cầu")}
      description={
        groups.length
          ? t(
              "request-detail",
              "{0} phần · {1} dòng · Cuộn ngang để xem thêm trường.",
              [groups.length, ticket.data_item?.dataform.data.length ?? 0],
            )
          : undefined
      }
    >
      {!groups.length && (
        <p className="text-sm text-muted-foreground">
          {t("request-detail", "Yêu cầu này không có biểu mẫu chi tiết.")}
        </p>
      )}
      {groups.map((group, index) => {
        const selected = fields.filter(
          (field) =>
            field.groupIndex === index &&
            canViewTicketField(field, { creator, processor }),
        );
        if (!selected.length) return null;
        const canEdit = mayEditSection(index);
        const active = editing === index && canEdit;
        return (
          <Card
            key={index}
            className={`min-w-0 gap-0 py-0 shadow-none ${active ? "border-primary/40" : ""}`}
          >
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border bg-muted/30 px-3 py-2 sm:px-4">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-medium text-muted-foreground"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <h3 className="min-w-0 text-sm font-semibold">
                  <TruncatedText text={group.title} />
                </h3>
              </div>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-2">
                  {active ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-9 gap-1.5 sm:h-8 sm:w-auto sm:px-3"
                        aria-label={t("request-detail", "Hủy")}
                        title={t("request-detail", "Hủy chỉnh sửa")}
                        disabled={mutation.isPending}
                        onClick={() => {
                          setEditing(null);
                          form.reset({ rows: ticketDetailRows(ticket) });
                          mutation.reset();
                        }}
                      >
                        <X className="size-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">
                          {t("request-detail", "Hủy")}
                        </span>
                      </Button>
                      <AsyncButton
                        type="button"
                        loading={mutation.isPending}
                        size="icon"
                        className="size-9 gap-1.5 sm:h-8 sm:w-auto sm:px-3"
                        aria-label={t("request-detail", "Lưu thay đổi")}
                        title={t("request-detail", "Lưu thay đổi")}
                        icon={<Save className="size-3.5" aria-hidden="true" />}
                        onClick={() => save(index)}
                      >
                        <span className="hidden sm:inline">
                          {t("request-detail", "Lưu thay đổi")}
                        </span>
                      </AsyncButton>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9 gap-1.5 sm:h-8 sm:w-auto sm:px-3"
                      aria-label={t("request-detail", "Chỉnh sửa")}
                      title={t("request-detail", "Chỉnh sửa phần này")}
                      disabled={editing !== null}
                      onClick={() => {
                        form.reset({ rows: ticketDetailRows(ticket) });
                        mutation.reset();
                        setEditing(index);
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">
                        {t("request-detail", "Chỉnh sửa")}
                      </span>
                    </Button>
                  )}
                </div>
              )}
            </div>
            {active && mutation.isError && (
              <ErrorToast message={mutation.error.message} />
            )}
            <div
              role="group"
              aria-label={t("request-detail", "Dữ liệu {0}", [group.title])}
              className="max-w-full overflow-x-auto"
            >
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="min-w-12 p-3 text-left">#</th>
                    {selected.map((field) => (
                      <th
                        key={field.fieldKey}
                        className="min-w-60 p-3 text-left font-medium"
                      >
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger
                              type="button"
                              className="block max-w-54 truncate rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {field.title}
                            </TooltipTrigger>
                            <TooltipContent className="whitespace-normal wrap-anywhere">
                              {field.title}
                            </TooltipContent>
                          </Tooltip>
                          {field.required && (
                            <span className="shrink-0 text-destructive">*</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ticket.data_item?.dataform.data ?? []).map(
                    (record, row) => (
                      <tr
                        key={String(record.key ?? row)}
                        className="border-t border-border align-top"
                      >
                        <td className="p-3 text-muted-foreground">{row + 1}</td>
                        {selected.map((field) => (
                          <td
                            key={field.fieldKey}
                            className="min-w-60 p-3"
                            style={{
                              minWidth: Math.min(
                                600,
                                Math.max(
                                  240,
                                  Number(field.widthcol ?? field.width) || 240,
                                ),
                              ),
                            }}
                          >
                            {active ? (
                              <RequestDetailField
                                form={form}
                                field={field}
                                fields={fields}
                                row={row}
                                hideLabel
                                disabled={
                                  mutation.isPending || !mayEditField(field)
                                }
                              />
                            ) : (
                              <p className="max-w-120 whitespace-pre-wrap wrap-anywhere">
                                {String(
                                  record[
                                    typeof field.dataIndex === "string"
                                      ? field.dataIndex
                                      : field.title
                                  ] ?? "",
                                )}
                              </p>
                            )}
                          </td>
                        ))}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              {!ticket.data_item?.dataform.data.length && (
                <p className="p-4 text-sm text-muted-foreground">
                  {t("request-detail", "Chưa có dòng dữ liệu.")}
                </p>
              )}
            </div>
          </Card>
        );
      })}
    </RequestFormSection>
  );
}
