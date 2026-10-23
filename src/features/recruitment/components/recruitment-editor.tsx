import { ErrorToast } from "@/components/error-toast";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
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
import { LoadingState } from "@/components/loading-state";
import {
  DataTable,
  DataText,
  formatDataDate,
  formatDataDateTime,
} from "@/components/data-management";
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
import { RecruitmentStatusBadge } from "./recruitment-status-badge";
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
  const detailKind = ["candidate", "view-candidate"].includes(state.action)
    ? "candidates"
    : "requests";
  const detail = useQuery({
    queryKey: ["recruitment-detail", userId, detailKind, state.row.id],
    queryFn: ({ signal }) =>
      recruitmentDetail(detailKind, state.row.id!, signal),
    enabled: needsDetail,
    staleTime: 60_000,
    retry: false,
  });
  const duplicate = useQuery({
    queryKey: ["recruitment-duplicate", userId, state.row.id],
    queryFn: ({ signal }) =>
      recruitmentObject(
        API_ENDPOINTS.recruitment.checkCandidate(state.row.id),
        undefined,
        signal,
      ),
    enabled: state.action === "duplicate",
    retry: false,
  });
  let active: typeof detail | typeof duplicate | null = null;
  if (needsDetail) active = detail;
  if (state.action === "duplicate") active = duplicate;
  // A cached profile can be stale after a save. Mount the form only after
  // this opening's fetch finishes; subsequent refetches must preserve drafts.
  const [freshAtOpen] = useState(() => detail.isSuccess && !detail.isStale);
  const loading = editorLoading(
    active,
    needsDetail,
    freshAtOpen,
    detail.isFetchedAfterMount,
  );
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
      <DialogContent
        data-editor-action={state.action}
        className="flex max-w-[57.6rem] flex-col overflow-hidden p-1 sm:p-1 data-[editor-action=note]:h-[min(48rem,calc(100dvh-2rem))]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-pt-28 scroll-pb-24 rounded-lg p-4 sm:p-6">
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
          {loading && <LoadingState message="Đang tải thông tin..." />}
          {active?.isError && <ErrorToast message={active.error.message} />}
          {editorReady(active, loading) &&
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
    <div className="flex h-80 min-w-0 flex-col">
      <DataTable
        className="min-w-[1630px]"
        scrollLabel="Cuộn bảng tuyển dụng"
        rows={rows}
        getRowKey={(row) =>
          String(row.id ?? row.code_cv ?? JSON.stringify(row))
        }
        label="Hồ sơ trùng"
        columns={[
          {
            id: "index",
            label: "STT",
            width: "60px",
            align: "center",
            render: (_row, index) => index + 1,
          },
          {
            id: "code_cv",
            label: "Mã CV",
            width: "150px",
            render: (row) => <DataText text={recruitmentText(row.code_cv)} />,
          },
          {
            id: "ticket_code",
            label: "Mã yêu cầu",
            width: "160px",
            render: (row) => (
              <DataText text={recruitmentText(row.ticket_code)} />
            ),
          },
          {
            id: "numberphone",
            label: "Số điện thoại",
            width: "150px",
            render: (row) => (
              <DataText text={recruitmentText(row.numberphone)} />
            ),
          },
          {
            id: "email",
            label: "Email",
            width: "220px",
            render: (row) => <DataText text={recruitmentText(row.email)} />,
          },
          {
            id: "name",
            label: "Họ và tên",
            width: "200px",
            render: (row) => (
              <DataText
                text={[
                  recruitmentText(row.last_name).trim(),
                  recruitmentText(row.first_name).trim(),
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            ),
          },
          {
            id: "birthday",
            label: "Ngày sinh",
            width: "140px",
            render: (row) => (
              <DataText text={formatDataDate(recruitmentText(row.birthday))} />
            ),
          },
          {
            id: "status",
            label: "Trạng thái CV",
            width: "160px",
            className: "whitespace-nowrap",
            render: (row) => (
              <RecruitmentStatusBadge
                status={row.cv_status_name || row.cv_status__name}
              />
            ),
          },
          {
            id: "created",
            label: "Ngày tạo",
            width: "190px",
            render: (row) => (
              <DataText
                text={formatDataDateTime(recruitmentText(row.created))}
              />
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

function editorLoading(
  query: { isPending: boolean; isError: boolean } | null,
  needsDetail: boolean,
  freshAtOpen: boolean,
  fetchedAfterMount: boolean,
) {
  return Boolean(
    (query?.isPending || (needsDetail && !freshAtOpen && !fetchedAfterMount)) &&
    !query?.isError,
  );
}
function editorReady(
  query: { isPending: boolean; isError: boolean } | null,
  loading: boolean,
) {
  return !loading && (query ? !query.isPending && !query.isError : true);
}
