import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingState } from "@/components/loading-state";
import { DataTable, DataText } from "@/components/data-management";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import type {
  RecruitmentEditorState,
  RecruitmentLookups,
  RecruitmentRow,
} from "../types";
import { recruitmentDetail, recruitmentObject } from "../api/recruitment-api";
import { recruitmentRows, recruitmentText } from "../utils/recruitment-format";
import { actionLabels } from "../utils/recruitment-fields";
import { RecruitmentEditorForm } from "./recruitment-editor-form";
import { RecruitmentEditorTabs } from "./recruitment-editor-tabs";
import { RecruitmentNoteHistory } from "./recruitment-note-history";
import { RecruitmentCandidateProfile } from "./recruitment-candidate-profile";
export function RecruitmentEditor({
  state,
  lookups,
  onClose,
}: Readonly<{
  state: RecruitmentEditorState;
  lookups: RecruitmentLookups;
  onClose: () => void;
}>) {
  const { userId } = useAuthContext();
  const [busy, setBusy] = useState(false);
  const needsDetail = [
    "request",
    "candidate",
    "view-candidate",
    "create-candidate",
  ].includes(state.action);
  const detail = useQuery({
    queryKey: ["recruitment-detail", userId, state.action, state.row.id],
    queryFn: ({ signal }) =>
      recruitmentDetail(
        ["candidate", "view-candidate"].includes(state.action)
          ? "candidates"
          : "requests",
        state.row.id!,
        signal,
      ),
    enabled: needsDetail,
    retry: false,
  });
  const duplicate = useQuery({
    queryKey: ["recruitment-duplicate", userId, state.row.id],
    queryFn: ({ signal }) =>
      recruitmentObject(`/check-cv/${state.row.id}`, undefined, signal),
    enabled: state.action === "duplicate",
    retry: false,
  });
  let active: typeof detail | typeof duplicate | null = null;
  if (needsDetail) active = detail;
  if (state.action === "duplicate") active = duplicate;
  let row = state.row;
  if (detail.data) row = detail.data.row;
  if (state.action === "create-candidate")
    row = {
      id: row.id,
      department_recruited: row.department_recruited,
      gender: "Nam",
    };
  const editorForm = (
    <RecruitmentEditorForm
      key={`${state.action}-${state.row.id}`}
      state={{ ...state, row }}
      lookups={{ ...lookups, reasons: detail.data ? detail.data.reasons : [] }}
      onClose={onClose}
      onBusy={setBusy}
    />
  );
  let editorContent = editorForm;
  if (state.action === "view-candidate")
    editorContent = (
      <RecruitmentCandidateProfile
        row={row}
        lookups={lookups}
        onClose={onClose}
      />
    );
  if (state.action === "candidate")
    editorContent = (
      <RecruitmentEditorTabs
        candidateId={state.row.id!}
        busy={busy}
        onClose={onClose}
      >
        {editorForm}
      </RecruitmentEditorTabs>
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="flex max-w-3xl flex-col overflow-hidden p-1 sm:p-1">
        <div className="min-h-0 overflow-y-auto overscroll-contain scroll-pt-28 scroll-pb-24 rounded-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogHeading
              icon={<BriefcaseBusiness />}
              title={actionLabels[state.action]}
              description={
                state.action === "view-candidate"
                  ? "Thông tin ứng viên và tệp CV."
                  : "Kiểm tra thông tin trước khi lưu thay đổi."
              }
            />
            <DialogCloseButton disabled={busy} />
          </DialogHeader>
          {state.action === "note" && (
            <p className="mb-4 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              Ứng viên:{" "}
              <span className="font-medium">
                {recruitmentText(state.row.first_name) ||
                  recruitmentText(state.row.code_cv)}
              </span>
            </p>
          )}
          {active?.isPending && (
            <LoadingState message="Đang tải thông tin..." />
          )}
          {active?.isError && (
            <div className="space-y-3">
              <ErrorAlert message={active.error.message} />
              <Button onClick={() => void active.refetch()}>
                Thử lại thông tin
              </Button>
            </div>
          )}
          {editorReady(active) &&
            (state.action === "duplicate" ? (
              <DuplicateResults
                rows={recruitmentRows(duplicate.data && duplicate.data.results)}
              />
            ) : (
              editorContent
            ))}
          {state.action === "note" && (
            <div className="mt-6">
              <RecruitmentNoteHistory candidateId={state.row.id!} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
function DuplicateResults({ rows }: Readonly<{ rows: RecruitmentRow[] }>) {
  return rows.length ? (
    <div className="h-80">
      <DataTable
        scrollLabel="Cuộn bảng tuyển dụng"
        rows={rows}
        getRowKey={(row) =>
          String(row.id ?? row.code_cv ?? JSON.stringify(row))
        }
        label="Hồ sơ trùng"
        columns={[
          {
            id: "code_cv",
            label: "Mã CV",
            render: (row) => <DataText text={recruitmentText(row.code_cv)} />,
          },
          {
            id: "first_name",
            label: "Họ và tên",
            render: (row) => (
              <DataText text={recruitmentText(row.first_name)} />
            ),
          },
          {
            id: "numberphone",
            label: "Số điện thoại",
            render: (row) => (
              <DataText text={recruitmentText(row.numberphone)} />
            ),
          },
        ]}
      />
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">
      Không tìm thấy hồ sơ trùng lặp.
    </p>
  );
}

function editorReady(query: { isPending: boolean; isError: boolean } | null) {
  return query ? !query.isPending && !query.isError : true;
}
