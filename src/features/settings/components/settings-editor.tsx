import { t, useLocale } from "@/i18n";
import { ErrorToast } from "@/components/error-toast";
import { useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { localizedToast as toast } from "@/i18n/toast";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { CheckboxField } from "@/components/form/checkbox-field";
import { LoadingState } from "@/components/loading-state";
import { FormFieldShell } from "@/components/form/form-field-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogCloseButton,
  DialogFooter,
} from "@/components/ui/dialog";
import type { SettingsKind, SettingsRecord } from "../types";
import { settingsConfig } from "../utils/settings-config";
import {
  getSettingsDefaults,
  getSettingsFormSchema,
} from "../utils/settings-form";
import { saveSettingsRequest } from "../api/settings-api";
import { useSettingsFormData } from "../hooks/use-settings-form-data";
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
  useLocale();
  const { userId, refreshUserPermission } = useAuthContext();
  const client = useQueryClient();
  const config = settingsConfig[kind];
  const { detail, lookups, needsDetail, currentRecord, loading, ready } =
    useSettingsFormData(kind, record);
  const form = useForm({
    resolver: zodResolver(
      getSettingsFormSchema(
        kind,
        Boolean(record),
        lookups.data ?? {},
        currentRecord,
      ),
    ),
    values: getSettingsDefaults(currentRecord),
    resetOptions: { keepDirtyValues: true },
  });
  const [attachment, setAttachment] = useState<File>();
  const [attachmentError, setAttachmentError] = useState("");
  const submitting = useRef(false);
  const mutation = useMutation({
    mutationFn: (values: ReturnType<typeof getSettingsDefaults>) =>
      saveSettingsRequest(kind, values, currentRecord, attachment),
    retry: false,
    onMutate: () => onBusyChange(true),
    onSuccess: async () => {
      await Promise.all(
        [
          "settings-lookups",
          "report-groups",
          "report-types",
          "request-types",
          "handling-request-types",
          "request-teams",
          ...(kind === "handling-departments"
            ? [
                "request-create-lookups",
                "request-create-types",
                "requests",
                "request-detail",
              ]
            : []),
        ].map((key) =>
          client.invalidateQueries({ queryKey: [key], refetchType: "none" }),
        ),
      );
      // Invalidate details for the next visit, without reloading the open form.
      await client.invalidateQueries({
        queryKey: ["settings", kind, userId],
        refetchType: "none",
      });
      toast.success(
        record
          ? t("settings", "Đã cập nhật dữ liệu.")
          : t("settings", "Đã thêm dữ liệu."),
      );
      onClose();
      const refreshList = client.refetchQueries({
        type: "active",
        predicate: ({ queryKey }) =>
          queryKey[0] === "settings" &&
          queryKey[1] === kind &&
          queryKey[2] === userId &&
          queryKey[3] !== "detail",
      });
      if (
        kind === "positions" ||
        kind === "users" ||
        kind === "handling-departments"
      )
        await refreshUserPermission();
      await refreshList;
    },
    onSettled: () => {
      submitting.current = false;
      onBusyChange(false);
    },
  });
  const busy = mutation.isPending;
  return (
    <div className="relative" aria-busy={loading}>
      <form
        aria-label={`${record ? t("settings", "Chỉnh sửa") : t("settings", "Thêm")} ${config.label}`}
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          if (submitting.current || attachmentError || !ready) return;
          submitting.current = true;
          mutation.mutate(values);
        })}
      >
        {needsDetail && detail.isError && (
          <ErrorToast message={detail.error.message} />
        )}
        {lookups.isError && (
          <ErrorToast
            message={t("settings", "Không tải được danh mục: {0}", [
              lookups.error.message,
            ])}
          />
        )}
        {mutation.isError && <ErrorToast message={mutation.error.message} />}
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          {config.fields.map((field) => (
            <SettingsFieldControl
              key={field.name}
              field={field}
              form={form}
              lookups={lookups.data ?? {}}
              disabled={busy || !ready}
              editing={Boolean(record)}
            />
          ))}
          <CheckboxField
            control={form.control}
            name="is_active"
            id="settings-is-active"
            label={t("settings", "Kích hoạt")}
            disabled={busy || !ready}
          />
          {kind === "request-types" && (
            <FormFieldShell
              id="settings-attachment"
              label={t("settings", "Tài liệu hướng dẫn (PDF)")}
              className="sm:col-span-2"
              invalid={Boolean(attachmentError)}
              error={{ message: attachmentError }}
            >
              <Input
                id="settings-attachment"
                type="file"
                accept=".pdf,application/pdf"
                disabled={busy || !ready}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  const invalid =
                    file &&
                    (file.type !== "application/pdf" ||
                      !file.name.toLowerCase().endsWith(".pdf"));
                  setAttachmentError(
                    invalid ? t("settings", "Vui lòng chọn tệp PDF.") : "",
                  );
                  setAttachment(invalid ? undefined : file);
                }}
              />
              {currentRecord?.attachment_file && (
                <a
                  href={currentRecord.attachment_file}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  {t("settings", "Xem tài liệu hiện tại")}
                </a>
              )}
            </FormFieldShell>
          )}
        </div>
        <DialogFooter className="flex-nowrap [&>button]:flex-1 sm:[&>button]:flex-none">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            {t("settings", "Hủy")}
          </Button>
          <AsyncButton
            type="submit"
            loading={busy}
            loadingText={t("settings", "Đang lưu...")}
            disabled={!ready || Boolean(attachmentError)}
          >
            {t("settings", "Lưu")}
          </AsyncButton>
        </DialogFooter>
      </form>
      {loading && (
        <LoadingState
          message={t("settings", "Đang tải thông tin...")}
          className="absolute inset-0 z-20 rounded-lg bg-card/80"
        />
      )}
    </div>
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
  useLocale();
  const config = settingsConfig[kind];
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogHeading
            icon={<Settings2 aria-hidden="true" />}
            title={`${record ? t("settings", "Chỉnh sửa") : t("settings", "Thêm")} ${config.label}`}
            description={t(
              "settings",
              "Cập nhật thông tin và trạng thái hoạt động.",
            )}
          />
          <DialogCloseButton disabled={busy} />
        </DialogHeader>
        <SettingsForm
          kind={kind}
          record={record}
          onClose={onClose}
          onBusyChange={setBusy}
        />
      </DialogContent>
    </Dialog>
  );
}
