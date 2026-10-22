import { useEffect } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { SelectField } from "@/components/form/select-field";
import { MultiSelectField } from "@/components/form/multi-select-field";
import { TextareaField } from "@/components/form/textarea-field";
import type { RequestDetailData } from "../schemas/request-detail-schema";
import {
  availableUsers,
  assignmentModes,
  processingUsers,
  type TicketActionValues,
} from "../utils/ticket-actions";

export function TicketAssignmentFields({
  ticket,
  form,
  disabled,
}: Readonly<{
  ticket: RequestDetailData;
  form: UseFormReturn<TicketActionValues>;
  disabled: boolean;
}>) {
  const mode = useWatch({ control: form.control, name: "mode" });
  const selected = useWatch({ control: form.control, name: "users" });
  const { setValue } = form;
  useEffect(() => {
    setValue("users", []);
    setValue("oldUser", "");
    setValue("newUser", "");
    setValue("replacements", []);
    setValue("reason", "");
  }, [mode, setValue]);
  const available = availableUsers(ticket);
  const current = processingUsers(ticket).map((user) => ({
    value: String(user.user_id),
    label: user.username,
  }));
  const removingAllActive =
    mode === "delete" &&
    current.length > 0 &&
    current.every(({ value }) => selected.includes(value));
  const modes = assignmentModes(ticket);
  return (
    <div className="space-y-4">
      <SelectField
        control={form.control}
        name="mode"
        id="ticket-assignment-mode"
        label="Loại phân công"
        options={modes}
        searchable
        placeholder="Chọn loại phân công"
        disabled={disabled}
        required
      />
      {!modes.some((option) => !option.disabled) && (
        <p role="status" className="text-sm text-muted-foreground">
          Hiện không có người phù hợp để thêm hoặc thay thế. Yêu cầu phải giữ ít
          nhất một người xử lý.
        </p>
      )}
      {mode === "change" && (
        <>
          <SelectField
            control={form.control}
            name="oldUser"
            id="ticket-assignment-old"
            label="Người đang xử lý"
            options={current}
            searchable
            disabled={disabled}
            required
          />
          <SelectField
            control={form.control}
            name="newUser"
            id="ticket-assignment-new"
            label="Người nhận xử lý mới"
            options={available}
            searchable
            disabled={disabled}
            required
          />
        </>
      )}
      {(mode === "add" || mode === "delete") && (
        <MultiSelectField
          control={form.control}
          name="users"
          id="ticket-assignment-users"
          label={
            mode === "delete"
              ? "Người cần xóa khỏi yêu cầu"
              : "Người nhận xử lý"
          }
          options={mode === "delete" ? current : available}
          placeholder="Chọn người xử lý"
          disabled={disabled}
          required
        />
      )}
      {mode && mode !== "add" && (
        <TextareaField
          control={form.control}
          name="reason"
          id="ticket-assignment-reason"
          label={
            mode === "delete"
              ? "Lý do xóa người xử lý"
              : "Lý do thay đổi người xử lý"
          }
          disabled={disabled}
          required
        />
      )}
      {removingAllActive && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">
            Bạn đã chọn tất cả người đang xử lý. Chọn người thay thế bên dưới;
            nếu để trống, yêu cầu sẽ được hoàn thành sau khi xóa.
          </p>
          <MultiSelectField
            control={form.control}
            name="replacements"
            id="ticket-assignment-replacements"
            label="Người nhận xử lý thay thế"
            options={available}
            placeholder="Chọn người thay thế"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
