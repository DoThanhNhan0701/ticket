import { useState } from "react";
import { format, isValid } from "date-fns";
import { MessageSquare, Pencil, Reply } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseButton,
} from "@/components/ui/dialog";
import type {
  RequestDetailData,
  TicketMessage,
} from "../schemas/request-detail-schema";
import {
  addTicketComment,
  replyTicketComment,
  editTicketComment,
} from "../api/ticket-discussion-api";
import { ticketFileUrl } from "../utils/ticket-detail";
import { CommentComposer } from "./comment-composer";
import { TicketFiles } from "./ticket-files";

function MentionContent({ text }: Readonly<{ text: string }>) {
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">
      {text.split(/(@[\p{L}\p{N}_.-]+)/u).map((part, index) =>
        part.startsWith("@") ? (
          <span
            key={index}
            className="rounded bg-primary/10 px-0.5 font-medium text-brand-700 dark:text-brand-200"
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}
function CommentMessage({
  message,
  onEdit,
  onReply,
  replyDisabled,
}: Readonly<{
  message: TicketMessage;
  onEdit?: () => void;
  onReply?: () => void;
  replyDisabled?: boolean;
}>) {
  const date = new Date(message.created);
  const timestamp = isValid(date) ? format(date, "dd/MM/yyyy HH:mm") : "";
  return (
    <article
      className="group/comment min-w-0 space-y-2"
      aria-label={`Phản hồi của ${message.username}`}
    >
      <div className="flex min-w-0 items-start gap-2">
        <UserAvatar
          name={message.username}
          src={message.avatar ? ticketFileUrl(message.avatar) : undefined}
          className="size-7"
        />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            title={message.username}
          >
            {message.username}
          </p>
          {timestamp && (
            <time
              dateTime={message.created}
              className="text-xs text-muted-foreground"
            >
              {timestamp}
            </time>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 transition-opacity group-focus-within/comment:pointer-events-auto group-focus-within/comment:opacity-100 group-hover/comment:pointer-events-auto group-hover/comment:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:pointer-events-none [@media(hover:hover)_and_(pointer:fine)]:opacity-0">
          {onReply && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0 rounded-lg"
              aria-label="Trả lời"
              title="Trả lời"
              onClick={onReply}
              disabled={replyDisabled}
            >
              <Reply className="size-4" />
            </Button>
          )}
          {onEdit && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0 rounded-lg"
              aria-label={`Chỉnh sửa phản hồi của ${message.username}`}
              title="Chỉnh sửa phản hồi"
              onClick={onEdit}
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      <MentionContent text={message.content} />
      {Object.keys(message.att_file).length > 0 && (
        <TicketFiles files={message.att_file} layout="tiles" />
      )}
    </article>
  );
}
interface EditingComment {
  message: TicketMessage;
  level: "comment" | "reply";
}
function EditCommentDialog({
  editing,
  onClose,
  onSaved,
}: Readonly<{
  editing: EditingComment;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}>) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa bình luận</DialogTitle>
          <DialogCloseButton
            disabled={busy}
            aria-label="Đóng chỉnh sửa bình luận"
          />
        </DialogHeader>
        <CommentComposer
          editing
          label="Nội dung bình luận"
          initialContent={editing.message.content}
          existingFiles={editing.message.att_file}
          onSend={(draft) =>
            editTicketComment(editing.message.id, editing.level, draft)
          }
          onSaved={onSaved}
          onDone={onClose}
          onCancel={onClose}
          onBusyChange={setBusy}
        />
      </DialogContent>
    </Dialog>
  );
}
export function TicketDiscussion({
  ticket,
  onSaved,
}: Readonly<{ ticket: RequestDetailData; onSaved: () => Promise<unknown> }>) {
  const { username } = useAuthContext();
  const canEdit = (message: TicketMessage) =>
    Boolean(username && message.username === username);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyBusy, setReplyBusy] = useState(false);
  const [editing, setEditing] = useState<EditingComment | null>(null);
  return (
    <div className="min-w-0 space-y-4">
      <Card className="min-w-0 gap-0 p-4 sm:p-5">
        <CommentComposer
          onSend={(draft) =>
            addTicketComment(ticket.id, draft.content, draft.files)
          }
          onSaved={onSaved}
        />
      </Card>
      {ticket.comments.length > 0 ? (
        <div className="min-w-0 space-y-3">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <MessageSquare className="size-4" />
            {ticket.comments.length} cuộc trao đổi
          </p>
          {ticket.comments.map((comment) => (
            <Card key={comment.id} className="min-w-0 gap-2 p-3">
              <CommentMessage
                message={comment}
                onEdit={
                  canEdit(comment)
                    ? () => setEditing({ message: comment, level: "comment" })
                    : undefined
                }
                onReply={() =>
                  setReplyTo(replyTo === comment.id ? null : comment.id)
                }
                replyDisabled={replyBusy}
              />
              {comment.item_comment.length > 0 && (
                <div className="ml-2 min-w-0 space-y-3 border-l-2 border-border pl-3">
                  {comment.item_comment.map((reply) => (
                    <CommentMessage
                      key={reply.id}
                      message={reply}
                      onEdit={
                        canEdit(reply)
                          ? () => setEditing({ message: reply, level: "reply" })
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
              {replyTo === comment.id && (
                <div className="min-w-0 rounded-lg border border-border bg-muted/20 p-3">
                  <CommentComposer
                    label={`Trả lời ${comment.username}`}
                    onSend={(draft) => replyTicketComment(comment.id, draft)}
                    onSaved={onSaved}
                    onDone={() => setReplyTo(null)}
                    onCancel={() => setReplyTo(null)}
                    onBusyChange={setReplyBusy}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          <MessageSquare className="size-6" aria-hidden="true" />
          <p>Chưa có phản hồi.</p>
        </div>
      )}
      {editing && (
        <EditCommentDialog
          key={`${editing.level}-${editing.message.id}`}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
