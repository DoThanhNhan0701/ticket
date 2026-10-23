import { Harness } from "../harness";
import { menu } from "../discovery";
import { listPage } from "./navigation";
import { settingsCrud, cleanupSettings } from "./settings";
import { requestJourney, cleanupRequest } from "./requests";
import { prepareActionActors, ticketActionJourney } from "./ticket-actions";
import { hrJourney, hrCancelJourney } from "./hr";

export async function extendedJourney(h: Harness) {
  await settingsCrud(h);
  await prepareActionActors(h);
  await requestJourney(h);
  await ticketActionJourney(h);
  if (process.env.E2E_DETAIL_ONLY === "true") await hrCancelJourney(h);
  if (process.env.E2E_TICKET_ACTIONS_ONLY !== "true") {
    for (const item of menu.filter((item) => item.module === "recruitment"))
      await listPage(h, item);
    await hrJourney(h);
  }
  await cleanupRequest(h);
  await cleanupSettings(h);
}
