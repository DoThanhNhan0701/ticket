import { t } from "@/i18n";
import { z } from "zod";
import {
  createdRequestSchema,
  type CreateRequestValues,
  type CreatedRequest,
} from "../schemas/create-request-schema";

const draftSchema = z.object({
  version: z.literal(1),
  fileKey: z.string(),
  savedAt: z.number(),
  values: z.object({
    handling_group: z.string(),
    ticket_type: z.string(),
    approve_user: z.string(),
    fore_cus: z.string(),
    bophansudung: z.string(),
    other1: z.array(z.string()),
    vanphong: z.string(),
    title: z.string(),
    description: z.string(),
    duedate: z.string(),
    rows: z.array(z.object({ values: z.record(z.string(), z.string()) })),
  }),
  files: z.array(
    z.object({ name: z.string(), size: z.number(), lastModified: z.number() }),
  ),
  created: createdRequestSchema.optional(),
});
export type RequestCreateDraft = z.infer<typeof draftSchema>;
export type DraftFile = RequestCreateDraft["files"][number];
export const draftFileMatches = (file: DraftFile, other: DraftFile) =>
  file.name === other.name &&
  file.size === other.size &&
  file.lastModified === other.lastModified;

export function requestDraftKey(userId: number | null, clone: string | null) {
  return userId
    ? `request-create-draft:v1:${userId}:${clone ?? "new"}`
    : undefined;
}
export function readRequestDraft(key?: string): RequestCreateDraft | undefined {
  if (!key) return;
  try {
    const result = draftSchema.safeParse(
      JSON.parse(sessionStorage.getItem(key) ?? "null"),
    );
    if (result.success) return result.data;
  } catch {
    /* Storage may be unavailable. */
  }
}
export function writeRequestDraft(
  key: string | undefined,
  draft: RequestCreateDraft,
) {
  if (!key) return false;
  try {
    sessionStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
export function removeRequestDraft(key?: string) {
  if (!key) return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Storage is optional. */
  }
}

// Attachment bytes stay local; sessionStorage only holds their metadata.
let database: Promise<IDBDatabase> | undefined;
function openDraftFiles() {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(
          new Error(t("request-create", "Attachment storage unavailable")),
        );
        return;
      }
      const request = indexedDB.open("ticket-request-drafts", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("files");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error(t("request-create", "Attachment storage is blocked")));
    }).catch((error: unknown) => {
      database = undefined;
      throw error;
    });
  }
  return database;
}
type StoredFile = { blob: Blob; name: string; lastModified: number };
export async function readDraftFiles(key: string): Promise<File[]> {
  const db = await openDraftFiles();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("files", "readonly")
      .objectStore("files")
      .get(key);
    request.onsuccess = () =>
      resolve(
        ((request.result ?? []) as StoredFile[]).map(
          (file) =>
            new File([file.blob], file.name, {
              type: file.blob.type,
              lastModified: file.lastModified,
            }),
        ),
      );
    request.onerror = () => reject(request.error);
  });
}
export async function writeDraftFiles(key: string, files: File[]) {
  const db = await openDraftFiles();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("files", "readwrite");
    const store = transaction.objectStore("files");
    if (files.length)
      store.put(
        files.map((file) => ({
          blob: file,
          name: file.name,
          lastModified: file.lastModified,
        })),
        key,
      );
    else store.delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
export function createDraft(
  values: CreateRequestValues,
  files: File[],
  fileKey: string,
  created?: CreatedRequest,
): RequestCreateDraft {
  return {
    version: 1,
    fileKey,
    savedAt: Date.now(),
    values,
    created,
    files: files.map(({ name, size, lastModified }) => ({
      name,
      size,
      lastModified,
    })),
  };
}
