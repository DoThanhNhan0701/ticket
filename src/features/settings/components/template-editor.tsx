import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingState } from "@/components/loading-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { FormFieldShell } from "@/components/form/form-field-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
  DialogFooter,
} from "@/components/ui/dialog";
import { getRequestTemplate, saveRequestTemplate } from "../api/template-api";
import {
  prepareTemplate,
  type TemplateGroup,
} from "../schemas/template-schema";
import type { SettingsRecord } from "../types";
import { TemplateCheckbox, TemplateFieldControls } from "./template-fields";

function moveItem<T>(items: readonly T[], from: number, to: number) {
  const copy = [...items];
  if (to >= 0 && to < copy.length)
    [copy[from], copy[to]] = [copy[to], copy[from]];
  return copy;
}
function TemplateGroupFields({
  group,
  index,
  groups,
  disabled,
  onChange,
}: Readonly<{
  group: TemplateGroup;
  index: number;
  groups: readonly TemplateGroup[];
  disabled: boolean;
  onChange: (group: TemplateGroup) => void;
}>) {
  return (
    <section
      aria-label={`Phần ${index + 1}`}
      className="min-w-0 space-y-4 rounded-xl border border-border p-3 sm:p-4"
    >
      <FormFieldShell id={`template-group-${index}`} label="Tên phần" required>
        <Input
          id={`template-group-${index}`}
          value={group.title}
          disabled={disabled}
          placeholder="Nhập tên phần"
          onChange={(event) =>
            onChange({ ...group, title: event.target.value })
          }
        />
      </FormFieldShell>
      <TemplateCheckbox
        id={`template-group-edit-${index}`}
        label="Cho phép chỉnh sửa phần"
        checked={group.editable === true}
        disabled={disabled}
        onChange={(editable) => onChange({ ...group, editable })}
      />
      {group.children.map((field, fieldIndex) => (
        <div
          key={`${index}-${fieldIndex}`}
          className="space-y-3 rounded-lg border border-border bg-muted/20 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm">Trường {fieldIndex + 1}</strong>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Đưa trường ${fieldIndex + 1} lên`}
                disabled={disabled || fieldIndex === 0}
                onClick={() =>
                  onChange({
                    ...group,
                    children: moveItem(
                      group.children,
                      fieldIndex,
                      fieldIndex - 1,
                    ),
                  })
                }
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Đưa trường ${fieldIndex + 1} xuống`}
                disabled={disabled || fieldIndex === group.children.length - 1}
                onClick={() =>
                  onChange({
                    ...group,
                    children: moveItem(
                      group.children,
                      fieldIndex,
                      fieldIndex + 1,
                    ),
                  })
                }
              >
                <ArrowDown className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Xóa trường ${fieldIndex + 1}`}
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...group,
                    children: group.children.filter(
                      (_, position) => position !== fieldIndex,
                    ),
                  })
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <TemplateFieldControls
            field={field}
            id={`template-${index}-${fieldIndex}`}
            groups={groups}
            disabled={disabled}
            onChange={(next) =>
              onChange({
                ...group,
                children: group.children.map((old, position) =>
                  position === fieldIndex ? next : old,
                ),
              })
            }
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() =>
          onChange({
            ...group,
            children: [
              ...group.children,
              {
                key: crypto.randomUUID(),
                title: "",
                type: "text",
                editable: true,
                required: false,
              },
            ],
          })
        }
      >
        <Plus className="size-4" aria-hidden="true" />
        Thêm trường
      </Button>
    </section>
  );
}
function TemplateForm({
  record,
  initialGroups,
  exists,
  onClose,
  onBusyChange,
}: Readonly<{
  record: SettingsRecord;
  initialGroups: TemplateGroup[];
  exists: boolean;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}>) {
  const { userId } = useAuthContext();
  const client = useQueryClient();
  const [groups, setGroups] = useState(initialGroups);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const mutation = useMutation({
    mutationFn: (forms: TemplateGroup[]) =>
      saveRequestTemplate(record.id, userId!, forms, exists),
    retry: false,
    onMutate: () => onBusyChange(true),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["settings-template"] });
      toast.success("Đã lưu biểu mẫu.");
      onClose();
    },
    onSettled: () => {
      submitting.current = false;
      onBusyChange(false);
    },
  });
  const busy = mutation.isPending;
  return (
    <form
      aria-label="Cấu hình biểu mẫu"
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (submitting.current || !userId) return;
        try {
          const forms = prepareTemplate(groups);
          setError("");
          submitting.current = true;
          mutation.mutate(forms);
        } catch (failure) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Biểu mẫu không hợp lệ.",
          );
        }
      }}
    >
      {error && <ErrorAlert message={error} />}
      {mutation.isError && <ErrorAlert message={mutation.error.message} />}
      {groups.map((group, index) => (
        <div key={index} className="min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Phần {index + 1}</h3>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Đưa phần ${index + 1} lên`}
                disabled={busy || index === 0}
                onClick={() => setGroups(moveItem(groups, index, index - 1))}
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Đưa phần ${index + 1} xuống`}
                disabled={busy || index === groups.length - 1}
                onClick={() => setGroups(moveItem(groups, index, index + 1))}
              >
                <ArrowDown className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Xóa phần ${index + 1}`}
                disabled={busy}
                onClick={() =>
                  setGroups(groups.filter((_, position) => position !== index))
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <TemplateGroupFields
            group={group}
            index={index}
            groups={groups}
            disabled={busy}
            onChange={(next) =>
              setGroups(
                groups.map((old, position) =>
                  position === index ? next : old,
                ),
              )
            }
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() =>
          setGroups([
            ...groups,
            { title: "", editable: true, colortitle: "#000000", children: [] },
          ])
        }
      >
        <Plus className="size-4" aria-hidden="true" />
        Thêm phần
      </Button>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onClose}
        >
          Hủy
        </Button>
        <AsyncButton
          type="submit"
          loading={busy}
          loadingText="Đang lưu..."
          disabled={!userId}
        >
          Lưu biểu mẫu
        </AsyncButton>
      </DialogFooter>
    </form>
  );
}
export function RequestTemplateEditor({
  record,
  onClose,
}: Readonly<{ record: SettingsRecord; onClose: () => void }>) {
  const { userId } = useAuthContext();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["settings-template", userId, record.id],
    queryFn: ({ signal }) => getRequestTemplate(record.id, signal),
    retry: false,
    staleTime: 0,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <div>
            <DialogTitle>Biểu mẫu · {record.name}</DialogTitle>
            <DialogDescription>
              Cấu hình các phần, trường nhập liệu và điều kiện ngày.
            </DialogDescription>
          </div>
          <DialogCloseButton disabled={busy} />
        </DialogHeader>
        {query.isPending && <LoadingState message="Đang tải biểu mẫu..." />}
        {query.isError && (
          <div className="space-y-2">
            <ErrorAlert message={query.error.message} />
            <Button variant="outline" onClick={() => void query.refetch()}>
              Thử lại biểu mẫu
            </Button>
          </div>
        )}
        {query.data && (
          <TemplateForm
            record={record}
            initialGroups={query.data.forms}
            exists={query.data.exists}
            onClose={onClose}
            onBusyChange={setBusy}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
