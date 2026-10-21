import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import {
  DataTable,
  DataText,
  formatDataDate,
  type DataColumn,
} from "@/components/data-management";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import type { RecruitmentRow, RecruitmentEditorState } from "../types";
import { interviewDetail, recruitmentArray } from "../api/recruitment-api";
import {
  recruitmentText as text,
  recruitmentRows,
  recruitmentOptions,
  names,
} from "../utils/recruitment-format";
import { useRecruitmentLookups } from "../hooks/use-recruitment-lookups";
import { RecruitmentRowActions } from "./recruitment-row-actions";
import { InterviewCandidateFilters } from "./interview-candidate-filters";
import { RecruitmentEditor } from "./recruitment-editor";
export function InterviewCandidates() {
  const { codeInterview = "" } = useParams();
  const { userId, permissions } = useAuthContext();
  const canManage = permissions?.can_hr_rec === true;
  const [applied, setApplied] = useState({
    search: "",
    gender: "",
    cv_status: "",
  });
  const statuses = useQuery({
    queryKey: ["recruitment-interview-statuses", userId],
    queryFn: ({ signal }) =>
      recruitmentArray("/list_status_cv/", undefined, signal),
    retry: false,
  });
  const [editor, setEditor] = useState<RecruitmentEditorState | null>(null);
  const query = useQuery({
    queryKey: [
      "recruitment-interview-candidates",
      userId,
      codeInterview,
      applied,
    ],
    queryFn: ({ signal }) => interviewDetail(codeInterview, applied, signal),
    retry: false,
  });
  const lookups = useRecruitmentLookups(canManage);
  const { interview, rows } = interviewData(query.data);
  const columns: DataColumn<RecruitmentRow>[] = [
    {
      id: "name",
      label: "Họ và tên",
      render: (row) => <DataText text={text(row.first_name)} />,
    },
    {
      id: "birthday",
      label: "Ngày sinh",
      render: (row) => <DataText text={formatDataDate(text(row.birthday))} />,
    },
    {
      id: "phone",
      label: "Số điện thoại",
      render: (row) => <DataText text={text(row.numberphone)} />,
    },
    {
      id: "email",
      label: "Email",
      render: (row) => <DataText text={text(row.email)} />,
    },
    {
      id: "time",
      label: "Giờ phỏng vấn",
      render: (row) => <DataText text={interviewTime(row)} />,
    },
    {
      id: "status",
      label: "Trạng thái CV",
      render: (row) => (
        <DataText text={text(row.cv_status__name || row.cv_status_name)} />
      ),
    },
    {
      id: "actions",
      label: "Thao tác",
      width: "210px",
      render: (row) => (
        <RecruitmentRowActions
          mode="interview"
          row={row}
          canManage={canManage}
          disabled={query.isFetching || (canManage && !lookups.data)}
          onAction={(action, selected) =>
            setEditor({
              action,
              row: {
                ...selected,
                id_interview: interview?.id,
                time_start: interviewTime(selected),
              },
              code: codeInterview,
            })
          }
        />
      ),
    },
  ];
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <InterviewCandidateFilters
        values={applied}
        statuses={recruitmentOptions(statuses.data)}
        busy={query.isFetching}
        onApply={(next) => {
          if (JSON.stringify(applied) === JSON.stringify(next))
            void query.refetch();
          else setApplied(next);
        }}
      />
      {query.isPending && <LoadingState message="Đang tải CV phỏng vấn..." />}
      {query.isError && (
        <div className="space-y-3">
          <ErrorAlert message={query.error.message} />
          <Button onClick={() => void query.refetch()}>
            Thử lại lịch phỏng vấn
          </Button>
        </div>
      )}
      {!query.isPending && !query.isError && (
        <>
          {interview && (
            <div className="grid gap-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2">
              <p className="font-semibold">{text(interview.title)}</p>
              <p>
                {formatDataDate(text(interview.start_date))} ·{" "}
                {text(interview.time_start).slice(0, 5)} –{" "}
                {text(interview.time_end).slice(0, 5)}
              </p>
              <p>Người phỏng vấn: {names(interview.data_user_interview)}</p>
              <p className="whitespace-pre-wrap">{text(interview.note)}</p>
            </div>
          )}

          <div className="flex min-h-64 flex-1 flex-col rounded-xl border bg-card">
            {rows.length ? (
              <DataTable
                scrollLabel="Cuộn bảng tuyển dụng"
                rows={rows}
                columns={columns}
                label="CV phỏng vấn"
                getRowKey={(row) => String(row.id)}
              />
            ) : (
              <p className="my-auto p-4 text-center text-sm text-muted-foreground">
                Không có ứng viên trong lịch phỏng vấn.
              </p>
            )}
          </div>
        </>
      )}
      {statuses.isError && <ErrorAlert message={statuses.error.message} />}
      {lookups.isError && <ErrorAlert message={lookups.error.message} />}
      {editor && (
        <RecruitmentEditor
          state={editor}
          lookups={lookups.data ?? {}}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

function interviewTime(row: RecruitmentRow) {
  const slot = recruitmentRows([row.data_interview_cv])[0];
  return text(slot?.time_start || row.time_start || row.day_start).slice(0, 5);
}

function interviewData(data: RecruitmentRow[] | undefined) {
  const interview = data?.[0];
  return { interview, rows: recruitmentRows(interview?.ls_cv_interview) };
}
