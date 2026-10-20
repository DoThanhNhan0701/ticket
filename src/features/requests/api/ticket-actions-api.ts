import { postRequest } from "@/lib/api/client";
import type { TicketActionStep } from "../utils/ticket-actions";
import { assertTicketSaved } from "./ticket-response";

export async function executeTicketActionStep(step: TicketActionStep) {
  assertTicketSaved(
    await postRequest<unknown>(step.endpoint, { body: step.body }),
  );
}
