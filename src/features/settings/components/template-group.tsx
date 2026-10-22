import { useId } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormFieldShell } from "@/components/form/form-field-shell";
import type { TemplateField, TemplateGroup } from "../schemas/template-schema";
import { moveTemplateItem } from "../utils/template";
import { TemplateCheckbox, TemplateFieldControls } from "./template-fields";
import { TemplateItemActions } from "./template-item-actions";

export function TemplateGroupFields({
  group,
  index,
  groups,
  disabled,
  expanded,
  onToggle,
  onChange,
  onMove,
  onRemove,
  onFieldChange,
  onFieldRemove,
}: Readonly<{
  group: TemplateGroup;
  index: number;
  groups: readonly TemplateGroup[];
  disabled: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChange: (group: TemplateGroup) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onFieldChange: (index: number, field: TemplateField) => void;
  onFieldRemove: (index: number) => void;
}>) {
  const panelId = useId();
  const title = group.title.trim() || `Phần ${index + 1}`;
  return (
    <section
      aria-label={`Phần ${index + 1}`}
      className="min-w-0 overflow-hidden rounded-xl border border-border"
    >
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 bg-muted/40 px-3 py-2 sm:px-4",
          expanded && "border-b border-border",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          className="col-span-2 h-auto min-h-11 min-w-0 justify-start gap-2.5 px-1 py-1 text-left sm:col-span-1 sm:h-auto sm:min-h-9"
          aria-label={`${expanded ? "Thu gọn" : "Mở rộng"} phần ${index + 1}`}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-sm font-semibold"
              title={title}
            >
              {title}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              {group.children.length} trường
            </span>
          </span>
          <ChevronDown
            className={cn(
              "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        </Button>
        <span className="text-xs text-muted-foreground sm:hidden">
          {group.children.length} trường
        </span>
        <TemplateItemActions
          label={`phần ${index + 1}`}
          disabled={disabled}
          first={index === 0}
          last={index === groups.length - 1}
          onMove={onMove}
          onRemove={onRemove}
        />
      </div>
      <div id={panelId} hidden={!expanded} className="space-y-3 p-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto] sm:gap-4">
          <FormFieldShell
            id={`template-group-${index}`}
            label="Tên phần"
            required
          >
            <Input
              id={`template-group-${index}`}
              value={group.title}
              disabled={disabled}
              placeholder="Ví dụ: Thông tin yêu cầu"
              onChange={(event) =>
                onChange({ ...group, title: event.target.value })
              }
            />
          </FormFieldShell>
          <TemplateCheckbox
            id={`template-group-edit-${index}`}
            label="Hiển thị khi tạo yêu cầu"
            checked={group.editable !== false}
            disabled={disabled}
            onChange={(editable) => onChange({ ...group, editable })}
          />
        </div>
        <div className="grid grid-cols-1 items-start gap-3">
          {group.children.map((field, fieldIndex) => (
            <div
              key={field.key ?? `${index}-${fieldIndex}`}
              className="min-w-0 rounded-lg border border-border bg-background/40"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
                <h4
                  className="min-w-0 truncate text-sm font-medium"
                  title={field.title || `Trường ${fieldIndex + 1}`}
                >
                  <span className="text-muted-foreground">
                    {fieldIndex + 1}.
                  </span>{" "}
                  {field.title || "Trường mới"}
                </h4>
                <TemplateItemActions
                  label={`trường ${fieldIndex + 1}`}
                  disabled={disabled}
                  first={fieldIndex === 0}
                  last={fieldIndex === group.children.length - 1}
                  onMove={(direction) =>
                    onChange({
                      ...group,
                      children: moveTemplateItem(
                        group.children,
                        fieldIndex,
                        fieldIndex + direction,
                      ),
                    })
                  }
                  onRemove={() => onFieldRemove(fieldIndex)}
                />
              </div>
              <div className="p-3">
                <TemplateFieldControls
                  field={field}
                  id={`template-${index}-${fieldIndex}`}
                  groups={groups}
                  disabled={disabled}
                  onChange={(next) => onFieldChange(fieldIndex, next)}
                />
              </div>
            </div>
          ))}
          {!group.children.length && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Chưa có trường nhập liệu. Thêm trường đầu tiên bên dưới.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed bg-transparent"
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
                  handling: false,
                  status: false,
                },
              ],
            })
          }
        >
          <Plus className="size-4" aria-hidden="true" />
          Thêm trường
        </Button>
      </div>
    </section>
  );
}
