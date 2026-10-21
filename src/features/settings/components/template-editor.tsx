import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogCloseButton,
  DialogFooter,
} from "@/components/ui/dialog";
import { getRequestTemplate, saveRequestTemplate } from "../api/template-api";
import {
  prepareTemplate,
  type TemplateGroup,
} from "../schemas/template-schema";
import type { SettingsRecord } from "../types";
import { TemplateGroupFields } from "./template-group";
import {
  moveTemplateItem,
  moveTemplateIndex,
  removeTemplateIndex,
  updateTemplateField,
  removeTemplateField,
  removeTemplateGroup,
} from "../utils/template";

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
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
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
      className="flex min-h-0 flex-1 flex-col"
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
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-3 sm:px-4">
        <div>
          <h3 className="text-sm font-semibold">Nội dung biểu mẫu</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {groups.length} phần ·{" "}
            {groups.reduce((count, group) => count + group.children.length, 0)}{" "}
            trường<span className="hidden sm:inline"> nhập liệu</span>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            setGroups([
              ...groups,
              {
                title: "",
                editable: true,
                colortitle: "#000000",
                children: [],
              },
            ])
          }
        >
          <Plus className="size-4" aria-hidden="true" />
          Thêm phần
        </Button>
      </div>
      <div
        role="region"
        aria-label="Nội dung biểu mẫu"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4"
      >
        {error && <ErrorAlert message={error} />}
        {mutation.isError && <ErrorAlert message={mutation.error.message} />}
        {!groups.length && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <FileText
              className="mb-1 size-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">Chưa có nội dung biểu mẫu</p>
            <p className="text-sm text-muted-foreground">
              Chọn “Thêm phần” để bắt đầu cấu hình các trường nhập liệu.
            </p>
          </div>
        )}
        {groups.map((group, index) => (
          <TemplateGroupFields
            key={index}
            group={group}
            index={index}
            groups={groups}
            disabled={busy}
            onFieldChange={(fieldIndex, next) =>
              setGroups((current) =>
                updateTemplateField(current, index, fieldIndex, next),
              )
            }
            onFieldRemove={(fieldIndex) =>
              setGroups((current) =>
                removeTemplateField(current, index, fieldIndex),
              )
            }
            expanded={expandedIndex === index}
            onToggle={() =>
              setExpandedIndex((current) => (current === index ? null : index))
            }
            onChange={(next) =>
              setGroups(
                groups.map((old, position) =>
                  position === index ? next : old,
                ),
              )
            }
            onMove={(direction) => {
              setGroups(moveTemplateItem(groups, index, index + direction));
              setExpandedIndex((current) =>
                moveTemplateIndex(current, index, index + direction),
              );
            }}
            onRemove={() => {
              setGroups((current) => removeTemplateGroup(current, index));
              setExpandedIndex((current) =>
                removeTemplateIndex(current, index),
              );
            }}
          />
        ))}
      </div>
      <DialogFooter className="static m-0 shrink-0 flex-nowrap p-3 sm:m-0 sm:px-4 [&>button]:flex-1 sm:[&>button]:flex-none">
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
      <DialogContent className="flex h-[90dvh] max-w-none flex-col overflow-hidden p-0 sm:p-0 lg:w-63/100 lg:max-w-252">
        <DialogHeader className="static m-0 shrink-0 p-3 sm:m-0 sm:p-4">
          <DialogHeading
            icon={<FileText aria-hidden="true" />}
            title={`Biểu mẫu · ${record.name}`}
            description="Thêm phần, sắp xếp trường và thiết lập cách nhập liệu."
          />
          <DialogCloseButton disabled={busy} />
        </DialogHeader>
        {query.isPending && <LoadingState message="Đang tải biểu mẫu..." />}
        {query.isError && (
          <div className="space-y-2 p-4">
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
