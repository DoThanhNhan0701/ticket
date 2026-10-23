import { useContext, useEffect, useId } from "react";
import { PendingAttachmentsContext } from "../context/pending-attachments-context";

export function usePendingAttachments(count: number) {
  const update = useContext(PendingAttachmentsContext);
  const id = useId();
  useEffect(() => {
    update?.(id, count);
    return () => update?.(id, 0);
  }, [update, id, count]);
}
