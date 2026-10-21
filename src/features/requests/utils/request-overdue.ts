import { parseISO } from "date-fns";
import type { RequestTicket } from "../types";

export function isRequestOverdue(
  request: Pick<RequestTicket, "duedate" | "ticket_status">,
  now = new Date(),
) {
  // V2 compares timestamps: an ISO date due today starts at local midnight.
  return (
    ![4, 5, 7].includes(request.ticket_status) &&
    parseISO(request.duedate).getTime() <= now.getTime()
  );
}
