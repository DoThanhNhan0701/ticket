import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { UseFormReturn } from "react-hook-form";
import type {
  CreateRequestValues,
  CreatedRequest,
} from "../schemas/create-request-schema";
import {
  createDraft,
  draftFileMatches,
  readDraftFiles,
  readRequestDraft,
  removeRequestDraft,
  requestDraftKey,
  writeDraftFiles,
  writeRequestDraft,
  type DraftFile,
} from "../utils/request-create-draft";

export function useRequestCreateDraftKey(userId: number | null) {
  const [params] = useSearchParams();
  const key = requestDraftKey(userId, params.get("clone"));
  const [saved] = useState(() => readRequestDraft(key));
  return { key, saved };
}

export function useRequestCreateDraft({
  key,
  enabled,
  saved,
  form,
  files,
  setFiles,
  createdRef,
  pendingFiles,
}: Readonly<{
  key?: string;
  enabled: boolean;
  saved?: ReturnType<typeof readRequestDraft>;
  form: UseFormReturn<CreateRequestValues>;
  files: File[];
  setFiles: (files: File[]) => void;
  createdRef: { current: CreatedRequest | undefined };
  pendingFiles: { current: File[] };
}>) {
  const [loading, setLoading] = useState(Boolean(saved?.files.length));
  const [missing, setMissing] = useState<DraftFile[]>([]);
  const [storageError, setStorageError] = useState(false);
  const fileKey = useRef(saved?.fileKey ?? crypto.randomUUID());
  const active = useRef(true);
  const currentFiles = useRef(files);
  currentFiles.current = files;
  const persist = useCallback(() => {
    if (!active.current || loading || !enabled) return;
    const nextFiles = createdRef.current
      ? pendingFiles.current
      : currentFiles.current;
    const draft = createDraft(
      form.getValues(),
      nextFiles,
      fileKey.current,
      createdRef.current,
    );
    // Preserve metadata until missing files have been reselected.
    draft.files.push(
      ...missing.filter(
        (file) =>
          !currentFiles.current.some((other) =>
            draftFileMatches(file, other),
          ) && !draft.files.some((other) => draftFileMatches(file, other)),
      ),
    );
    if (key && !writeRequestDraft(key, draft)) setStorageError(true);
  }, [form, loading, missing, key, enabled, createdRef, pendingFiles]);
  useEffect(() => {
    if (!saved?.files.length) return;
    let mounted = true;
    void readDraftFiles(fileKey.current)
      .catch(() => [] as File[])
      .then((restored) => {
        if (!mounted) return;
        const recovered = restored.filter((file) =>
          saved.files.some((other) => draftFileMatches(file, other)),
        );
        setMissing(
          saved.files.filter(
            (file) => !recovered.some((other) => draftFileMatches(file, other)),
          ),
        );
        setFiles(recovered);
        if (createdRef.current) pendingFiles.current = recovered;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [saved, setFiles, createdRef, pendingFiles]);
  useEffect(() => {
    setMissing((previous) => {
      const next = previous.filter(
        (file) => !files.some((other) => draftFileMatches(file, other)),
      );
      return next.length === previous.length ? previous : next;
    });
  }, [files]);
  useEffect(() => {
    const subscription = form.watch(() => persist());
    persist();
    return () => subscription.unsubscribe();
  }, [form, persist, files]);
  useEffect(() => {
    if (loading || !key || !enabled) return;
    void writeDraftFiles(fileKey.current, files).catch(() => {
      if (files.length) setStorageError(true);
    });
  }, [files, loading, key, enabled]);
  const clear = () => {
    active.current = false;
    removeRequestDraft(key);
    void writeDraftFiles(fileKey.current, []).catch(() => {});
  };
  const restart = () => {
    clear();
    setMissing([]);
    active.current = true;
  };
  return {
    restored: Boolean(saved),
    discardMissing: (file: DraftFile) =>
      setMissing((previous) =>
        previous.filter((other) => !draftFileMatches(file, other)),
      ),
    loading,
    persist,
    clear,
    restart,
    storageError,
    missing: missing.filter(
      (file) => !files.some((other) => draftFileMatches(file, other)),
    ),
  };
}
