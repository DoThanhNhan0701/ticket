import { useId, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from "@/hooks/use-debounce";
import { searchMentionUsers } from "../api/ticket-discussion-api";

import { mentionAtCaret } from "../utils/comment-mentions";
export function CommentMentions({
  id,
  label,
  value,
  onChange,
  disabled,
  invalid,
  children,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  invalid: boolean;
  children?: ReactNode;
}>) {
  const input = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [caret, setCaret] = useState(value.length);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState(0);
  const mention = focused && !dismissed ? mentionAtCaret(value, caret) : null;
  const search = useDebounce(mention?.search ?? "", 300);
  const users = useQuery({
    queryKey: ["comment-mention-users", search],
    queryFn: ({ signal }) => searchMentionUsers(search, signal),
    enabled: Boolean(mention?.search && search === mention.search && !disabled),
    retry: false,
  });
  const current = Boolean(mention?.search && mention.search === search);
  const options = current ? (users.data ?? []) : [];
  const open = Boolean(mention?.search && !disabled);
  const choose = (username: string) => {
    if (!mention) return;
    const insertion = `@${username} `;
    onChange(
      value.slice(0, mention.start) + insertion + value.slice(mention.end),
    );
    const position = mention.start + insertion.length;
    setCaret(position);
    setDismissed(true);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(position, position);
    });
  };
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <CommentInputFrame invalid={invalid}>
        <Textarea
          ref={input}
          id={id}
          value={value}
          disabled={disabled}
          rows={2}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : `${id}-hint`}
          aria-autocomplete="list"
          aria-controls={open ? listId : undefined}
          aria-activedescendant={
            open && options[selected] ? `${listId}-${selected}` : undefined
          }
          placeholder="Nhập phản hồi, gõ @ để nhắc đến người dùng..."
          className="min-h-14 max-h-[min(40dvh,15rem)] min-w-0 resize-none overflow-y-auto border-0 bg-transparent py-1.5 field-sizing-content shadow-none ring-0 whitespace-pre-wrap wrap-anywhere focus-visible:ring-0"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={(event) => {
            setCaret(event.currentTarget.selectionStart);
            setDismissed(false);
            setSelected(0);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setCaret(event.target.selectionStart);
            setDismissed(false);
            setSelected(0);
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyDown={(event) => {
            if (!open) return;
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setDismissed(true);
            }
            if (
              options.length &&
              ["ArrowDown", "ArrowUp"].includes(event.key)
            ) {
              event.preventDefault();
              setSelected(
                (index) =>
                  (index +
                    (event.key === "ArrowDown" ? 1 : options.length - 1)) %
                  options.length,
              );
            }
            if (
              options[selected] &&
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              choose(options[selected].username);
            }
          }}
        />
        {children}
      </CommentInputFrame>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Gõ @ và tên để nhắc đến người dùng. Mỗi tệp tối đa 50 MB.
      </p>
      {invalid && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          Vui lòng nhập phản hồi.
        </p>
      )}
      {open && (
        <MentionSuggestions
          listId={listId}
          selected={selected}
          options={options}
          onChoose={choose}
          status={suggestionStatus(current, users.isError, users.isSuccess)}
        />
      )}
    </div>
  );
}

function CommentInputFrame({
  invalid,
  children,
}: Readonly<{ invalid: boolean; children: ReactNode }>) {
  return (
    <div
      className={`min-w-0 rounded-2xl border bg-card p-1.5 shadow-xs focus-within:ring-2 focus-within:ring-ring/25 ${invalid ? "border-destructive" : "border-input focus-within:border-ring"}`}
    >
      {children}
    </div>
  );
}
function suggestionStatus(current: boolean, failed: boolean, success: boolean) {
  if (current && failed)
    return "Không tải được người dùng. Bạn vẫn có thể nhập @tên trực tiếp.";
  if (current && success) return "Không tìm thấy người dùng đang hoạt động.";
  return "Đang tìm người dùng...";
}
function MentionSuggestions({
  listId,
  options,
  selected,
  onChoose,
  status,
}: Readonly<{
  listId: string;
  options: Awaited<ReturnType<typeof searchMentionUsers>>;
  selected: number;
  onChoose: (username: string) => void;
  status: string;
}>) {
  return (
    <div className="max-h-52 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-sm">
      <div id={listId} role="listbox" aria-label="Người dùng được gắn thẻ">
        {options.map((user, index) => (
          <button
            key={user.username}
            id={`${listId}-${index}`}
            type="button"
            role="option"
            aria-selected={index === selected}
            tabIndex={-1}
            className={`flex min-h-11 w-full min-w-0 flex-col justify-center rounded-md px-3 py-2 text-left text-sm ${index === selected ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChoose(user.username)}
          >
            <span className="max-w-full truncate font-medium">
              @{user.username}
            </span>
            {user.email && (
              <span className="max-w-full truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            )}
          </button>
        ))}
      </div>
      {!options.length && (
        <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
          {status}
        </p>
      )}
    </div>
  );
}
