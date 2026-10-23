import { createContext } from "react";

export const PendingAttachmentsContext = createContext<
  ((id: string, count: number) => void) | null
>(null);
