import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveFilters } from "@/components/data-management/responsive-filters";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Download, Search } from "lucide-react";
import { DatePickerField } from "@/components/form/date-picker-field";
import { SelectField } from "@/components/form/select-field";
import { ErrorAlert } from "@/components/error-alert";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { listReportTypesRequest } from "../api/reports-api";
import {
  reportFilterSchema,
  type ReportFilters,
  type ReportGroup,
} from "../schemas/reports-schema";
import type { ReportMode } from "../utils/report-options";

function TypeFeedback({
  error,
  empty,
  retry,
}: Readonly<{ error: Error | null; empty: boolean; retry: () => void }>) {
  if (error)
    return (
      <div className="space-y-2">
        <ErrorAlert message={`Không tải được loại yêu cầu: ${error.message}`} />
        <Button type="button" variant="outline" onClick={retry}>
          Thử lại loại yêu cầu
        </Button>
      </div>
    );
  if (empty)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Bộ phận này không có loại yêu cầu đang hoạt động.
      </p>
    );
  return null;
}

export function ReportFiltersForm({
  mode,
  groups,
  initialValues,
  loading,
  exporting,
  onApply,
  onExport,
}: Readonly<{
  mode: ReportMode;
  groups: readonly ReportGroup[];
  initialValues: ReportFilters;
  loading: boolean;
  exporting: boolean;
  onApply: (values: ReportFilters) => void;
  onExport: (values: ReportFilters) => void;
}>) {
  const { userId } = useAuthContext();
  const mobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const form = useForm<ReportFilters>({
    resolver: zodResolver(reportFilterSchema),
    defaultValues: initialValues,
  });
  const groupId = useWatch({ control: form.control, name: "handlinggroup" });
  const { resetField } = form;
  useEffect(() => {
    resetField("ticket_type_id");
  }, [groupId, resetField]);
  const types = useQuery({
    queryKey: ["report-types", userId, groupId],
    queryFn: ({ signal }) => listReportTypesRequest(groupId, signal),
    enabled:
      mode === "export" && groups.some((group) => String(group.id) === groupId),
    retry: false,
  });
  const activeTypes = (types.data ?? []).filter(
    (type) => type.is_active && String(type.handling_group) === groupId,
  );
  const typeUnavailable =
    mode === "export" &&
    (types.isPending || types.isError || activeTypes.length === 0);
  const busy = loading || exporting;
  const submit = (values: ReportFilters, exportFile: boolean) => {
    if (busy || typeUnavailable) return;
    if (!groups.some((group) => String(group.id) === values.handlinggroup)) {
      form.setError("handlinggroup", {
        message: "Vui lòng chọn bộ phận xử lý hợp lệ.",
      });
      return;
    }
    if (
      mode === "export" &&
      values.ticket_type_id !== "All" &&
      !activeTypes.some((type) => String(type.id) === values.ticket_type_id)
    ) {
      form.setError("ticket_type_id", {
        message: "Vui lòng chọn loại yêu cầu.",
      });
      return;
    }
    if (exportFile) onExport(values);
    else onApply(values);
    setMobileOpen(false);
  };
  return (
    <ResponsiveFilters
      mobile={mobile}
      open={mobileOpen}
      onOpenChange={setMobileOpen}
      activeCount={0}
    >
      <Card className="gap-4 p-4 sm:p-5">
        <form
          aria-label={
            mode === "export" ? "Truy xuất dữ liệu" : "Bộ lọc báo cáo"
          }
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            submit(values, mode === "export"),
          )}
        >
          <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DatePickerField
              control={form.control}
              name="startdate"
              id={`${mode}-startdate`}
              label="Từ ngày"
              required
              disabled={busy}
              endYear={new Date().getFullYear() + 1}
            />
            <DatePickerField
              control={form.control}
              name="enddate"
              id={`${mode}-enddate`}
              label="Đến ngày"
              required
              disabled={busy}
              endYear={new Date().getFullYear() + 1}
            />
            <SelectField
              control={form.control}
              name="handlinggroup"
              id={`${mode}-group`}
              label="Bộ phận xử lý"
              required
              searchable
              disabled={busy}
              placeholder="Chọn bộ phận xử lý"
              options={groups.map((group) => ({
                value: String(group.id),
                label: group.name,
              }))}
            />
            {mode === "export" && (
              <SelectField
                control={form.control}
                name="ticket_type_id"
                id="export-type"
                label="Loại yêu cầu"
                allOptionValue="All"
                required
                searchable
                disabled={busy || typeUnavailable}
                placeholder="Chọn loại yêu cầu"
                isLoading={types.isFetching}
                options={
                  activeTypes.length
                    ? [
                        { value: "All", label: "Tất cả loại yêu cầu" },
                        ...activeTypes.map((type) => ({
                          value: String(type.id),
                          label: type.name,
                        })),
                      ]
                    : []
                }
              />
            )}
          </div>
          {mode === "export" && (
            <TypeFeedback
              error={types.error}
              empty={types.isSuccess && activeTypes.length === 0}
              retry={() => void types.refetch()}
            />
          )}
          <div className="grid auto-cols-fr grid-flow-col gap-2 sm:flex sm:flex-wrap">
            {mode === "dashboard" && (
              <AsyncButton
                title="Tra cứu"
                type="submit"
                className="min-w-0"
                loading={loading}
                loadingText={
                  <span className="truncate" title="Đang tra cứu...">
                    Đang tra cứu...
                  </span>
                }
                disabled={exporting}
                icon={<Search className="size-4" aria-hidden="true" />}
              >
                Tra cứu
              </AsyncButton>
            )}
            <AsyncButton
              title="Xuất Excel"
              type={mode === "export" ? "submit" : "button"}
              className="min-w-0"
              variant={mode === "export" ? "default" : "outline"}
              loading={exporting}
              loadingText={
                <span className="truncate" title="Đang xuất Excel...">
                  Đang xuất Excel...
                </span>
              }
              disabled={loading || typeUnavailable}
              icon={<Download className="size-4" aria-hidden="true" />}
              onClick={
                mode === "dashboard"
                  ? form.handleSubmit((values) => submit(values, true))
                  : undefined
              }
            >
              Xuất Excel
            </AsyncButton>
          </div>
        </form>
      </Card>
    </ResponsiveFilters>
  );
}
