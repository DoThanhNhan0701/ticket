import { z } from "zod";
import { getRequest, postRequest, putRequest } from "@/lib/api/client";
import { parseApiResponse } from "@/lib/api/response-schema";
import { assertTicketSaved } from "./ticket-response";

export const MAX_COMMENT_FILE_SIZE = 50 * 1024 * 1024;
export interface DiscussionDraft {
  content: string;
  files: File[];
  removedFiles: string[];
}
function commentBody(content: string, files: readonly File[]) {
  if (!content.trim()) throw new Error("Vui lòng nhập phản hồi.");
  const body = new FormData();
  for (const file of files) {
    if (file.size > MAX_COMMENT_FILE_SIZE)
      throw new Error(`Tệp “${file.name}” vượt quá 50 MB.`);
    body.append("att_file", file);
  }
  if (!files.length) body.append("att_file", "");
  return body;
}
export async function addTicketComment(
  id: number,
  content: string,
  files: readonly File[] = [],
) {
  const body = commentBody(content, files);
  body.append("ticket_id", String(id));
  body.append("ticket_comment", content.trim());
  assertTicketSaved(await postRequest("/ticket_comment", { body }));
}
export async function replyTicketComment(id: number, draft: DiscussionDraft) {
  const body = commentBody(draft.content, draft.files);
  body.append("comment_id", String(id));
  body.append("comment_content", draft.content.trim());
  assertTicketSaved(await postRequest("/ticket_item_comment", { body }));
}
export async function editTicketComment(
  id: number,
  level: "comment" | "reply",
  draft: DiscussionDraft,
) {
  const body = commentBody(draft.content, draft.files);
  body.append("comment_id", String(id));
  body.append("content_comment", draft.content.trim());
  for (const name of draft.removedFiles) body.append("deleted_old_files", name);
  if (!draft.removedFiles.length) body.append("deleted_old_files", "");
  assertTicketSaved(
    await putRequest(
      level === "comment" ? "/ticket_comment" : "/ticket_item_comment",
      { body },
    ),
  );
}
const mentionUserSchema = z.object({
  id: z.number().optional(),
  username: z.string(),
  email: z.string().nullish(),
  is_active: z.boolean(),
});
export async function searchMentionUsers(search: string, signal?: AbortSignal) {
  return parseApiResponse(
    z.array(mentionUserSchema),
    await getRequest("/list_user_v2/", {
      params: { search, type_api: "tag_comment" },
      signal,
    }),
    "Không tải được người dùng để gắn thẻ.",
  )
    .filter((user) => user.is_active)
    .slice(0, 20);
}
