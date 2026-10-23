import { ErrorToast } from "@/components/error-toast";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import {
  DataClientResults,
  DataTable,
  DataText,
  formatDataDate,
  type DataColumn,
} from "@/components/data-management";
import type { RecruitmentRow, RecruitmentEditorState } from "../types";
import { interviewDetail, recruitmentArray } from "../api/recruitment-api";
import {
  recruitmentText as text,
  recruitmentRows,
  recruitmentOptions,
  names,
} from "../utils/recruitment-format";
import { useRecruitmentLookups } from "../hooks/use-recruitment-lookups";
import {
  RecruitmentActionChooser,
  RecruitmentRowActions,
} from "./recruitment-row-actions";
import { InterviewCandidateFilters } from "./interview-candidate-filters";
import { RecruitmentEditor } from "./recruitment-editor";
import { RecruitmentStatusBadge } from "./recruitment-status-badge";
export function InterviewCandidates() {
  const { codeInterview = "" } = useParams();
  const { userId, permissions } = useAuthContext();
  const canManage = permissions?.can_hr_rec === true;
  const [paginationReset, resetPagination] = useState(0);
  const [applied, setApplied] = useState({
    search: "",
    gender: "",
    cv_status: "",
  });
  const statuses = useQuery({
    queryKey: ["recruitment-interview-statuses", userId],
    queryFn: ({ signal }) =>
      recruitmentArray(API_ENDPOINTS.recruitment.statuses, undefined, signal),
    enabled: !canManage,
    retry: false,
  });
  const [editor, setEditor] = useState<RecruitmentEditorState | null>(null);
  const [actionRow, setActionRow] = useState<RecruitmentRow | null>(null);
  const query = useQuery({
    queryKey: [
      "recruitment-interview-candidates",
      userId,
      codeInterview,
      applied,
    ],
    queryFn: ({ signal }) => interviewDetail(codeInterview, applied, signal),
    placeholderData: (previous, old) =>
      old?.queryKey[1] === userId && old.queryKey[2] === codeInterview
        ? previous
        : undefined,
    retry: false,
  });
  const lookups = useRecruitmentLookups(canManage);
  const { interview, rows } = interviewData(query.data);
  const openAction = (
    action: RecruitmentEditorState["action"],
    selected: RecruitmentRow,
  ) =>
    setEditor({
      action,
      row: {
        ...selected,
        id_interview: interview?.id,
        time_start: interviewTime(selected),
      },
      code: codeInterview,
      timeRange: {
        start: text(interview?.time_start).slice(0, 5),
        end: text(interview?.time_end).slice(0, 5),
      },
    });
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
        <RecruitmentStatusBadge
          status={row.cv_status__name || row.cv_status_name}
        />
      ),
    },
    {
      id: "actions",
      label: "Thao tác",
      width: "80px",
      sticky: "right",
      render: (row) => (
        <RecruitmentRowActions
          mode="interview"
          row={row}
          canManage={canManage}
          disabled={
            query.isFetching || query.isError || (canManage && !lookups.data)
          }
          onAction={openAction}
          open={false}
          onOpenChange={(nextOpen) => {
            if (nextOpen) setActionRow(row);
          }}
        />
      ),
    },
  ];
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <InterviewCandidateFilters
        values={applied}
        statuses={
          canManage
            ? (lookups.data?.statuses ?? [])
            : recruitmentOptions(statuses.data)
        }
        busy={query.isFetching}
        onApply={(next) => {
          resetPagination((current) => current + 1);
          if (JSON.stringify(applied) === JSON.stringify(next))
            void query.refetch();
          else setApplied(next);
        }}
      />
      {!query.isPending && !query.isError && interview && (
        <div className="grid gap-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2">
          <p className="font-semibold">{text(interview.title)}</p>
          <p>
            {formatDataDate(text(interview.start_date))} ·{" "}
            {text(interview.time_start).slice(0, 5)} –{" "}
            {text(interview.time_end).slice(0, 5)}
          </p>
          <p>Người phỏng vấn: {names(interview.data_user_interview)}</p>
          <p className="whitespace-pre-wrap wrap-anywhere">
            {text(interview.note)}
          </p>
        </div>
      )}
      <DataClientResults
        refreshStyle="subtle"
        scopeKey={JSON.stringify([codeInterview, applied, paginationReset])}
        query={{
          ...query,
          data: query.data ? { results: rows, count: rows.length } : undefined,
        }}
        label="Danh sách CV phỏng vấn"
        itemLabel="ứng viên"
        loadingMessage="Đang tải CV phỏng vấn..."
        errorPrefix="Không tải được CV phỏng vấn"
        emptyTitle="Không có ứng viên trong lịch phỏng vấn."
        renderRows={(visibleRows, offset) => (
          <DataTable
            scrollLabel="Cuộn bảng tuyển dụng"
            rows={visibleRows}
            columns={[
              {
                id: "index",
                label: "#",
                width: "60px",
                render: (_row, index) => offset + index + 1,
              },
              ...columns,
            ]}
            label="CV phỏng vấn"
            getRowKey={(row) => String(row.id)}
            scrollResetKey={JSON.stringify([codeInterview, applied, offset])}
          />
        )}
      />
      {!canManage && statuses.isError && (
        <ErrorToast message={statuses.error.message} />
      )}
      {lookups.isError && <ErrorToast message={lookups.error.message} />}
      <RecruitmentActionChooser
        mode="interview"
        row={actionRow}
        rows={rows}
        canManage={canManage}
        disabled={
          query.isFetching || query.isError || (canManage && !lookups.data)
        }
        onClose={() => setActionRow(null)}
        onAction={openAction}
      >
        {editor && (
          <RecruitmentEditor
            state={editor}
            lookups={lookups.data ?? {}}
            onClose={() => setEditor(null)}
          />
        )}
      </RecruitmentActionChooser>
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
