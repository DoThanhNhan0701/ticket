import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { ErrorAlert } from "@/components/error-alert";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import type {
  RecruitmentEditorState,
  RecruitmentLookups,
  RecruitmentListData,
  RecruitmentValues,
} from "../types";
import { listRecruitment } from "../api/recruitment-api";
import { recruitmentDate, recruitmentText } from "../utils/recruitment-format";
import {
  recruitmentFields,
  recruitmentUploadNames,
  actionLabels,
} from "../utils/recruitment-fields";
import {
  recruitmentDefaults,
  recruitmentFormSchema,
} from "../utils/recruitment-validation";
import { saveRecruitmentAction } from "../utils/recruitment-actions";
import { RecruitmentFormFields } from "./recruitment-form-fields";
import { RecruitmentFormExtras } from "./recruitment-form-extras";
import { RecruitmentNoteComposer } from "./recruitment-note-composer";
import { RecruitmentAddressStatus } from "./recruitment-address-status";
import { RecruitmentAttachStatus } from "./recruitment-attach-status";
import { useRecruitmentAddress } from "../hooks/use-recruitment-address";
export function RecruitmentEditorForm({
  state,
  lookups,
  onClose,
  onBusy,
}: Readonly<{
  state: RecruitmentEditorState;
  lookups: RecruitmentLookups;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
}>) {
  const { userId } = useAuthContext();
  const client = useQueryClient();
  const submitting = useRef(false);
  const baseFields = recruitmentFields(state.action, state.timeRange);
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const fileError = Object.values(fileErrors).filter(Boolean).join(" ");
  const optionsRef = useRef<RecruitmentLookups>(lookups);
  const form = useForm<RecruitmentValues>({
    defaultValues: editorDefaults(state, baseFields),
    resolver: (values, context, options) =>
      zodResolver(
        recruitmentFormSchema(
          state.action,
          baseFields,
          optionsRef.current,
          Boolean(state.row.id),
        ),
      )(values, context, options),
  });
  const address = useRecruitmentAddress(state, form, lookups, userId);
  const fields = addressFields(baseFields, address.legacy);
  const addressQueries = address.queries;
  const date = useWatch({ control: form.control, name: "start_date" });
  const [startTime, endTime] = useWatch({
    control: form.control,
    name: ["time_start", "time_end"],
  });
  const {
    trigger,
    formState: { isSubmitted },
  } = form;
  useEffect(() => {
    if (state.action === "interview" && isSubmitted)
      void trigger(["start_date", "time_end"]);
  }, [date, startTime, endTime, isSubmitted, state.action, trigger]);
  const previousDate = useRef(date);
  useEffect(() => {
    if (state.action === "attach" && date !== previousDate.current) {
      form.setValue("id_interview", "", { shouldValidate: isSubmitted });
      previousDate.current = date;
    }
  }, [date, form, state.action, isSubmitted]);
  const schedules = useQuery({
    queryKey: ["recruitment-attach-interviews", userId, date],
    queryFn: ({ signal }) =>
      listRecruitment(
        "interviews",
        {
          from_date: recruitmentDate(String(date)),
          to_date: recruitmentDate(String(date)),
        },
        signal,
      ),
    enabled:
      state.action === "attach" && Boolean(recruitmentDate(String(date ?? ""))),
    retry: false,
  });
  const options = {
    ...lookups,
    statuses: editorStatuses(state, lookups),
    cities: address.cities,
    districts: address.districts,
    genders: [
      { value: "Nam", label: "Nam" },
      { value: "Nữ", label: "Nữ" },
    ],
    interviews: (schedules.data?.results ?? []).map((row) => ({
      value: String(row.id),
      label: `${row.title} (${row.time_start} - ${row.time_end})`,
    })),
  };
  optionsRef.current = options;
  const mutation = useMutation({
    retry: false,
    mutationFn: (values: RecruitmentValues) =>
      saveRecruitmentAction(state, values, files),
    onMutate: () => onBusy(true),
    onSuccess: async () => {
      await client.invalidateQueries({
        predicate: (query) =>
          String(query.queryKey[0]).startsWith("recruitment"),
      });
      if (state.action === "note") {
        form.reset({ note: "" });
        setFiles({});
        setFileErrors({});
        toast.success("Đã thêm ghi chú.");
      } else {
        toast.success("Đã lưu thay đổi.");
        onClose();
      }
    },
    onSettled: () => {
      submitting.current = false;
      onBusy(false);
    },
  });
  const submit = form.handleSubmit((values) => {
    if (
      state.action === "note" &&
      !String(values.note ?? "").trim() &&
      !files.file_note
    ) {
      form.setError("note", {
        type: "manual",
        message: "Vui lòng nhập ghi chú hoặc đính kèm tệp.",
      });
      return;
    }
    if (
      submitting.current ||
      submissionBlocked(fileError, state.action, schedules.data, [
        ...addressQueries,
        schedules,
      ])
    )
      return;
    submitting.current = true;
    mutation.mutate(values);
  });
  const selectFile = (name: string, file: File | undefined) => {
    const limit =
      name === "file_upload" && state.action !== "request" ? 10 : 50;
    if (file && file.size > limit * 1024 * 1024) {
      setFiles((current) => ({ ...current, [name]: undefined }));
      setFileErrors((current) => ({
        ...current,
        [name]: `Tệp không được vượt quá ${limit} MB.`,
      }));
      return;
    }
    setFileErrors((current) => ({ ...current, [name]: "" }));
    setFiles((current) => ({ ...current, [name]: file }));
    if (name === "file_note" && file) form.clearErrors("note");
  };
  const noteField = ["candidate", "view-candidate", "note"].includes(
    state.action,
  )
    ? fields.find((field) => field.name === "note")
    : undefined;
  const uploadNames = recruitmentUploadNames(state.action).filter(
    (name) => !noteField || name !== "file_note",
  );
  return (
    <form
      aria-label={actionLabels[state.action]}
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        if (
          submissionBlocked(fileError, state.action, schedules.data, [
            ...addressQueries,
            schedules,
          ])
        ) {
          event.preventDefault();
          return;
        }
        void submit(event);
      }}
    >
      {fields.length === 0 && (
        <p className="rounded-lg border bg-muted/40 p-4 text-sm">
          {confirmationMessage(state)}
        </p>
      )}
      <RecruitmentFormFields
        fields={fields.filter((field) => !noteField || field.name !== "note")}
        form={form}
        lookups={options}
        disabled={mutation.isPending}
      />
      {state.action === "candidate" && (
        <p className="text-xs text-muted-foreground">
          Để thay đổi trạng thái CV, dùng chức năng Chuyển trạng thái trong cột
          Thao tác.
        </p>
      )}
      <RecruitmentAddressStatus
        address={address}
        disabled={mutation.isPending}
        readonly={state.action === "view-candidate"}
      />
      {state.action === "attach" && (
        <RecruitmentAttachStatus
          count={(state.ids ?? [state.row.id]).length}
          schedules={schedules}
          hasDate={Boolean(recruitmentDate(String(date ?? "")))}
        />
      )}
      {state.action !== "attach" && state.action !== "note" && (
        <RecruitmentFormExtras
          state={state}
          uploadNames={uploadNames}
          files={files}
          disabled={mutation.isPending}
          onFile={selectFile}
          hideInterviewFile={Boolean(noteField)}
        />
      )}
      {noteField && (
        <RecruitmentNoteComposer
          control={form.control}
          field={noteField}
          row={state.action === "note" ? {} : state.row}
          file={files.file_note}
          disabled={mutation.isPending}
          onFile={(file) => selectFile("file_note", file)}
        />
      )}
      {fileError && <ErrorAlert message={fileError} />}
      {mutation.isError && <ErrorAlert message={mutation.error.message} />}
      <DialogFooter className="mt-0 pt-0">
        <Button
          type="button"
          variant="outline"
          disabled={mutation.isPending}
          onClick={onClose}
        >
          {state.action === "view-candidate" ? "Đóng" : "Hủy"}
        </Button>
        {state.action !== "view-candidate" && (
          <AsyncButton
            type="submit"
            loading={mutation.isPending}
            disabled={submissionBlocked(
              fileError,
              state.action,
              schedules.data,
              [...addressQueries, schedules],
            )}
          >
            {submitLabel(state.action)}
          </AsyncButton>
        )}
      </DialogFooter>
    </form>
  );
}

function editorDefaults(
  state: RecruitmentEditorState,
  fields: ReturnType<typeof recruitmentFields>,
) {
  if (state.action === "status")
    return recruitmentDefaults(fields, { ...state.row, cv_status_id: null });
  if (state.action === "note") return recruitmentDefaults(fields, { note: "" });
  return recruitmentDefaults(fields, state.row);
}

function submitLabel(action: RecruitmentEditorState["action"]) {
  if (action === "note") return "Thêm ghi chú";
  if (action === "remove-interview-cv") return "Bỏ khỏi lịch phỏng vấn";
  if (action === "delete-file" || action === "delete-candidate")
    return actionLabels[action];
  return "Lưu";
}

function confirmationMessage(state: RecruitmentEditorState) {
  const name = recruitmentText(
    state.row.code_cv || state.row.title || state.row.id,
  );
  if (state.action === "delete-file")
    return `Xóa tệp “${recruitmentText(state.row.name_file_cv)}” khỏi hồ sơ ${name}? Thông tin ứng viên được giữ lại.`;
  if (state.action === "delete-candidate")
    return `Xóa toàn bộ hồ sơ ứng viên ${name}${state.row.first_name ? ` — ${recruitmentText(state.row.first_name)}` : ""}?`;
  if (state.action === "remove-interview-cv")
    return `Bỏ ứng viên ${recruitmentText(state.row.first_name) || name} khỏi lịch phỏng vấn ${state.code ?? ""}? Hồ sơ ứng viên và trạng thái CV được giữ lại.`;
  return `Xác nhận ${actionLabels[state.action].toLowerCase()} ${name}?`;
}

function submissionBlocked(
  error: string,
  action: string,
  schedules: RecruitmentListData | undefined,
  dependencies: readonly { isFetching: boolean; isError: boolean }[],
) {
  return (
    dependencies.some((query) => query.isFetching || query.isError) ||
    action === "view-candidate" ||
    Boolean(error) ||
    (action === "attach" && !schedules?.results.length)
  );
}

function editorStatuses(
  state: RecruitmentEditorState,
  lookups: RecruitmentLookups,
) {
  const statuses = lookups.statuses ?? [];
  if (state.action === "status")
    return statuses.filter(
      (option) => option.value !== String(state.row.cv_status_id),
    );
  return statuses;
}

function addressFields(
  fields: ReturnType<typeof recruitmentFields>,
  legacy: boolean,
) {
  return fields.map((field) =>
    legacy && field.name === "district_code"
      ? { ...field, label: "Quận/Huyện (địa chỉ cũ)" }
      : field,
  );
}
