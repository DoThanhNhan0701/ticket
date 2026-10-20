import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDataDate } from "@/components/data-management";
import type { RequestDetailData } from "../schemas/request-detail-schema";
import { ticketFileUrl } from "../utils/ticket-detail";
import { RequestFormSection } from "./request-form-section";
import { TicketFiles } from "./ticket-files";

function ReadField({
  label,
  value,
  fullWidth = false,
  multiline = false,
}: Readonly<{
  label: string;
  value: string;
  fullWidth?: boolean;
  multiline?: boolean;
}>) {
  const id = useId();
  return (
    <div
      className={`flex min-w-0 flex-col gap-2 text-sm font-medium ${fullWidth ? "sm:col-span-2 xl:col-span-4" : ""}`}
    >
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <Textarea
          id={id}
          readOnly
          value={value || "—"}
          rows={3}
          className="field-sizing-content min-h-22 min-w-0 resize-none overflow-x-hidden font-normal whitespace-pre-wrap wrap-anywhere sm:min-h-20 sm:pointer-coarse:min-h-22"
        />
      ) : (
        <Input
          id={id}
          readOnly
          value={value || "—"}
          title={value || "—"}
          className="font-normal"
        />
      )}
    </div>
  );
}

export function TicketGeneral({
  ticket,
}: Readonly<{ ticket: RequestDetailData }>) {
  const manual = ticketFileUrl(ticket.ticket_type_att_file);
  return (
    <div className="min-w-0 space-y-4">
      <RequestFormSection
        step={1}
        title="Loại yêu cầu"
        description="Chọn bộ phận phụ trách, loại yêu cầu và người phê duyệt."
      >
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ReadField label="Bộ phận xử lý" value={ticket.handling_group_name} />
          <ReadField label="Loại yêu cầu" value={ticket.ticket_type_name} />
          <ReadField label="Người phê duyệt" value={ticket.approve_user_name} />
          <ReadField label="Công ty" value={ticket.customer_name} />
        </div>
        {manual && (
          <a
            href={manual}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            Tài liệu hướng dẫn
          </a>
        )}
      </RequestFormSection>
      <RequestFormSection
        step={2}
        title="Thông tin yêu cầu"
        description="Nhập nội dung cần hỗ trợ và thông tin đơn vị sử dụng."
      >
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ReadField label="Tiêu đề yêu cầu" value={ticket.title} fullWidth />
          <ReadField label="Department" value={ticket.bophansudung_name} />
          <ReadField
            label="Team sử dụng"
            value={ticket.list_name_team_use
              .map((team) => team.name)
              .join(", ")}
          />
          <ReadField label="Văn phòng" value={ticket.vanphong_name} />
          <ReadField
            label="Ngày mong muốn"
            value={formatDataDate(ticket.duedate)}
          />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-4">
          <ReadField label="Người tạo" value={ticket.username_create} />
          <ReadField label="Ngày tạo" value={formatDataDate(ticket.created)} />
          <ReadField
            label="Ngày phê duyệt"
            value={formatDataDate(ticket.approve_date)}
          />
          <ReadField
            label="Người xử lý"
            value={ticket.list_user_received
              .map((user) => user.username)
              .join(", ")}
          />
        </div>
      </RequestFormSection>
      <RequestFormSection
        step={4}
        title="Thông tin bổ sung"
        description="Ghi chú và tài liệu đính kèm nếu cần."
      >
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <ReadField label="Ghi chú" value={ticket.description} multiline />
            {ticket.lydohuyyeucau && (
              <ReadField
                label="Lý do hủy"
                value={ticket.lydohuyyeucau}
                multiline
              />
            )}
            {ticket.lydoxulylai && (
              <ReadField
                label="Lý do xử lý lại"
                value={ticket.lydoxulylai}
                multiline
              />
            )}
            {ticket.lydokhongxulylai && (
              <ReadField
                label="Lý do không xử lý lại"
                value={ticket.lydokhongxulylai}
                multiline
              />
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-medium">Tệp đính kèm</h3>
            {Object.keys(ticket.attachment_files).length ? (
              <TicketFiles files={ticket.attachment_files} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Không có tệp đính kèm.
              </p>
            )}
          </div>
        </div>
      </RequestFormSection>
    </div>
  );
}
