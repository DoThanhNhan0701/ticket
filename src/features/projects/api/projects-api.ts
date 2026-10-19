import { getRequest } from "@/lib/api/client";

import type { ProjectOptionItem } from "../types";

export async function listProjectsRequest(): Promise<ProjectOptionItem[]> {
  return getRequest<ProjectOptionItem[]>("/list-project");
}
