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
  RecruitmentValues,
} from "../types";
import { recruitmentArray, listRecruitment } from "../api/recruitment-api";
import {
  recruitmentDate,
  recruitmentOptions,
  recruitmentText,
} from "../utils/recruitment-format";
import { recruitmentFields, actionLabels } from "../utils/recruitment-fields";
import {
  recruitmentDefaults,
  recruitmentFormSchema,
} from "../utils/recruitment-validation";
import { saveRecruitmentAction } from "../utils/recruitment-actions";
import { RecruitmentFormFields } from "./recruitment-form-fields";
import { RecruitmentFormExtras } from "./recruitment-form-extras";
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
  const fields = recruitmentFields(state.action);
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const fileError = Object.values(fileErrors).filter(Boolean).join(" ");
  const optionsRef = useRef<RecruitmentLookups>(lookups);
  const form = useForm<RecruitmentValues>({
    defaultValues: recruitmentDefaults(
      fields,
      state.action === "status"
        ? { ...state.row, cv_status_id: null }
        : state.row,
    ),
    resolver: (values, context, options) =>
      zodResolver(
        recruitmentFormSchema(
          state.action,
          fields,
          optionsRef.current,
          Boolean(state.row.id),
        ),
      )(values, context, options),
  });
  const city = useWatch({ control: form.control, name: "city_code" });
  const previousCity = useRef(city);
  useEffect(() => {
    if (city !== previousCity.current) {
      form.setValue("district_code", "", { shouldValidate: true });
      previousCity.current = city;
    }
  }, [city, form]);
  const districts = useQuery({
    queryKey: ["recruitment-districts", userId, city],
    queryFn: ({ signal }) =>
      recruitmentArray("/list_district/", { city_code: String(city) }, signal),
    enabled:
      fields.some(
        (field) => field.name === "district_code" && !field.readonly,
      ) && Boolean(city),
    retry: false,
  });
  useEffect(() => {
    if (districts.data && form.formState.errors.district_code)
      void form.trigger("district_code");
  }, [districts.data, form]);
  const date = useWatch({ control: form.control, name: "start_date" });
  const previousDate = useRef(date);
  useEffect(() => {
    if (state.action === "attach" && date !== previousDate.current) {
      form.setValue("id_interview", "", { shouldValidate: true });
      previousDate.current = date;
    }
  }, [date, form, state.action]);
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
    districts: recruitmentOptions(districts.data, "code"),
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
      toast.success("Đã lưu thay đổi.");
      onClose();
    },
    onSettled: () => {
      submitting.current = false;
      onBusy(false);
    },
  });
  const notes = useQuery({
    queryKey: ["recruitment-notes", userId, state.row.id],
    queryFn: ({ signal }) =>
      recruitmentArray(`/note-cv/${state.row.id}`, undefined, signal),
    enabled: ["candidate", "view-candidate", "note"].includes(state.action),
    retry: false,
  });
  const submit = form.handleSubmit((values) => {
    if (
      submitting.current ||
      submissionBlocked(fileError, state.action, schedules.data, [
        districts,
        schedules,
      ])
    )
      return;
    submitting.current = true;
    mutation.mutate(values);
  });
  const uploadNames = getUploadNames(state.action);
  return (
    <form
      aria-label={actionLabels[state.action]}
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        if (
          submissionBlocked(fileError, state.action, schedules.data, [
            districts,
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
          Xác nhận {actionLabels[state.action].toLowerCase()}{" "}
          {recruitmentText(
            state.row.code_cv || state.row.title || state.row.id,
          )}
          ?
        </p>
      )}
      <RecruitmentFormFields
        fields={fields}
        form={form}
        lookups={options}
        disabled={mutation.isPending}
      />
      {state.action === "attach" && (
        <>
          <p className="text-sm text-muted-foreground">
            Đã chọn {(state.ids ?? [state.row.id]).length} ứng viên.
          </p>
          {schedules.isError && (
            <ErrorAlert message={schedules.error.message} />
          )}
        </>
      )}
      <RecruitmentFormExtras
        state={state}
        uploadNames={uploadNames}
        notes={notes.data ?? []}
        noteError={notes.error}
        disabled={mutation.isPending}
        onFile={(name, file) => {
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
        }}
      />
      {districts.isError && (
        <div className="space-y-2">
          <ErrorAlert message={districts.error.message} />
          <Button
            type="button"
            variant="outline"
            onClick={() => void districts.refetch()}
          >
            Thử lại quận/huyện
          </Button>
        </div>
      )}
      {fileError && <ErrorAlert message={fileError} />}
      {mutation.isError && <ErrorAlert message={mutation.error.message} />}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={mutation.isPending}
          onClick={onClose}
        >
          Hủy
        </Button>
        {state.action !== "view-candidate" && (
          <AsyncButton
            type="submit"
            loading={mutation.isPending}
            disabled={submissionBlocked(
              fileError,
              state.action,
              schedules.data,
              [districts, schedules],
            )}
          >
            Lưu
          </AsyncButton>
        )}
      </DialogFooter>
    </form>
  );
}

function getUploadNames(action: string) {
  const names: Record<string, string[]> = {
    request: ["file_upload"],
    candidate: ["file_upload", "file_note"],
    "create-candidate": ["file_upload"],
    note: ["file_note"],
  };
  return names[action] ?? [];
}

function submissionBlocked(
  error: string,
  action: string,
  schedules: unknown,
  dependencies: readonly { isFetching: boolean; isError: boolean }[],
) {
  return (
    dependencies.some((query) => query.isFetching || query.isError) ||
    action === "view-candidate" ||
    Boolean(error) ||
    (action === "attach" && !schedules)
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
