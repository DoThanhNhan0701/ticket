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
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogHeading
            icon={<BriefcaseBusiness />}
            title={actionLabels[state.action]}
            description={
              state.action === "view-candidate"
                ? "Xem thông tin, tệp hồ sơ và ghi chú phỏng vấn."
                : "Kiểm tra thông tin trước khi lưu thay đổi."
            }
          />
          <DialogCloseButton disabled={busy} />
        </DialogHeader>
        {active?.isPending && <LoadingState message="Đang tải thông tin..." />}
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
            <RecruitmentEditorForm
              key={`${state.action}-${state.row.id}`}
              state={{ ...state, row }}
              lookups={{
                ...lookups,
                reasons: detail.data ? detail.data.reasons : [],
              }}
              onClose={onClose}
              onBusy={setBusy}
            />
          ))}
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
