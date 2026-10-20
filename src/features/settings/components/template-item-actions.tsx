import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TemplateItemActions({
  label,
  disabled,
  first,
  last,
  onMove,
  onRemove,
}: Readonly<{
  label: string;
  disabled: boolean;
  first: boolean;
  last: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}>) {
  return (
    <div className="flex shrink-0 items-center gap-1 [&>button]:size-11 sm:[&>button]:size-9 sm:pointer-coarse:[&>button]:size-11">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Đưa ${label} lên`}
        title="Di chuyển lên"
        disabled={disabled || first}
        onClick={() => onMove(-1)}
      >
        <ArrowUp className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Đưa ${label} xuống`}
        title="Di chuyển xuống"
        disabled={disabled || last}
        onClick={() => onMove(1)}
      >
        <ArrowDown className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="text-destructive hover:bg-danger-soft hover:text-destructive"
        aria-label={`Xóa ${label}`}
        title="Xóa"
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
