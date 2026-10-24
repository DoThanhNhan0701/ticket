import { t, useLocale } from "@/i18n";
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
  useLocale();
  return (
    <div className="flex shrink-0 items-center gap-1 [&>button]:size-11 sm:[&>button]:size-9 sm:pointer-coarse:[&>button]:size-11">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t("settings-templates", "Đưa {0} lên", [label])}
        title={t("settings-templates", "Di chuyển lên")}
        disabled={disabled || first}
        onClick={() => onMove(-1)}
      >
        <ArrowUp className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t("settings-templates", "Đưa {0} xuống", [label])}
        title={t("settings-templates", "Di chuyển xuống")}
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
        aria-label={t("settings-templates", "Xóa {0}", [label])}
        title={t("settings-templates", "Xóa")}
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
