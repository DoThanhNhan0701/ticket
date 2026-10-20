import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { CheckboxField } from "@/components/form/checkbox-field";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingState } from "@/components/loading-state";
import { FormFieldShell } from "@/components/form/form-field-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
  DialogFooter,
} from "@/components/ui/dialog";
import type { SettingsKind, SettingsRecord } from "../types";
import { settingsConfig } from "../utils/settings-config";
import {
  getSettingsDefaults,
  getSettingsFormSchema,
} from "../utils/settings-form";
import {
  settingsDetailRequest,
  settingsLookupsRequest,
  saveSettingsRequest,
} from "../api/settings-api";
import { SettingsFieldControl } from "./settings-fields";

function SettingsForm({
  kind,
  record,
  onClose,
  onBusyChange,
}: Readonly<{
  kind: SettingsKind;
  record?: SettingsRecord;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}>) {
  const { userId, refreshUserPermission } = useAuthContext();
  const client = useQueryClient();
  const config = settingsConfig[kind];
  const resources = [
    ...new Set(
      config.fields.flatMap((field) => (field.lookup ? [field.lookup] : [])),
    ),
  ];
  const lookups = useQuery({
    queryKey: ["settings-lookups", userId, resources],
    queryFn: ({ signal }) => settingsLookupsRequest(resources, signal),
    retry: false,
  });
  const form = useForm({
    resolver: zodResolver(
      getSettingsFormSchema(kind, Boolean(record), lookups.data ?? {}),
    ),
    defaultValues: getSettingsDefaults(record),
  });
  const [attachment, setAttachment] = useState<File>();
  const [attachmentError, setAttachmentError] = useState("");
  const submitting = useRef(false);
  const mutation = useMutation({
    mutationFn: (values: ReturnType<typeof getSettingsDefaults>) =>
      saveSettingsRequest(kind, values, record, attachment),
    retry: false,
    onMutate: () => onBusyChange(true),
    onSuccess: async () => {
      await Promise.all(
        [
          "settings",
          "settings-lookups",
          "report-groups",
          "report-types",
          "request-types",
          "handling-request-types",
          "request-teams",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
      if (kind === "positions" || kind === "users")
        await refreshUserPermission();
      toast.success(record ? "Đã cập nhật dữ liệu." : "Đã thêm dữ liệu.");
      onClose();
    },
    onSettled: () => {
      submitting.current = false;
      onBusyChange(false);
    },
  });
  const busy = mutation.isPending;
  return (
    <form
      aria-label={`${record ? "Chỉnh sửa" : "Thêm"} ${config.label}`}
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => {
        if (submitting.current || attachmentError || !lookups.isSuccess) return;
        submitting.current = true;
        mutation.mutate(values);
      })}
    >
      {lookups.isError && (
        <div className="space-y-2">
          <ErrorAlert
            message={`Không tải được danh mục: ${lookups.error.message}`}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void lookups.refetch()}
          >
            Thử lại danh mục
          </Button>
        </div>
      )}
      {lookups.isPending && <LoadingState message="Đang tải danh mục..." />}
      {mutation.isError && <ErrorAlert message={mutation.error.message} />}
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {config.fields.map((field) => (
          <SettingsFieldControl
            key={field.name}
            field={field}
            form={form}
            lookups={lookups.data ?? {}}
            disabled={busy || !lookups.isSuccess}
            editing={Boolean(record)}
          />
        ))}
        <CheckboxField
          control={form.control}
          name="is_active"
          id="settings-is-active"
          label="Kích hoạt"
          disabled={busy}
        />
        {kind === "request-types" && (
          <FormFieldShell
            id="settings-attachment"
            label="Tài liệu hướng dẫn (PDF)"
            className="sm:col-span-2"
            invalid={Boolean(attachmentError)}
            error={{ message: attachmentError }}
          >
            <Input
              id="settings-attachment"
              type="file"
              accept=".pdf,application/pdf"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                const invalid =
                  file &&
                  (file.type !== "application/pdf" ||
                    !file.name.toLowerCase().endsWith(".pdf"));
                setAttachmentError(invalid ? "Vui lòng chọn tệp PDF." : "");
                setAttachment(invalid ? undefined : file);
              }}
            />
            {record?.attachment_file && (
              <a
                href={record.attachment_file}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Xem tài liệu hiện tại
              </a>
            )}
          </FormFieldShell>
        )}
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onClose}
        >
          Hủy
        </Button>
        <AsyncButton
          type="submit"
          loading={busy}
          loadingText="Đang lưu..."
          disabled={!lookups.isSuccess || Boolean(attachmentError)}
        >
          Lưu
        </AsyncButton>
      </DialogFooter>
    </form>
  );
}

export function SettingsEditor({
  kind,
  record,
  onClose,
}: Readonly<{
  kind: SettingsKind;
  record?: SettingsRecord;
  onClose: () => void;
}>) {
  const { userId } = useAuthContext();
  const config = settingsConfig[kind];
  const [busy, setBusy] = useState(false);
  const needsDetail = Boolean(record && (config.paginated || kind === "users"));
  const detail = useQuery({
    queryKey: ["settings", kind, userId, "detail", record?.id],
    queryFn: ({ signal }) => settingsDetailRequest(kind, record!.id, signal),
    enabled: needsDetail,
    retry: false,
    staleTime: 0,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>
              {record ? "Chỉnh sửa" : "Thêm"} {config.label}
            </DialogTitle>
            <DialogDescription>
              Cập nhật thông tin và trạng thái hoạt động.
            </DialogDescription>
          </div>
          <DialogCloseButton disabled={busy} />
        </DialogHeader>
        {needsDetail && detail.isPending && (
          <LoadingState message="Đang tải thông tin..." />
        )}
        {needsDetail && detail.isError && (
          <div className="space-y-3">
            <ErrorAlert message={detail.error.message} />
            <Button variant="outline" onClick={() => void detail.refetch()}>
              Thử lại thông tin
            </Button>
          </div>
        )}
        {(!needsDetail || detail.isSuccess) && (
          <SettingsForm
            kind={kind}
            record={needsDetail ? detail.data : record}
            onClose={onClose}
            onBusyChange={setBusy}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
