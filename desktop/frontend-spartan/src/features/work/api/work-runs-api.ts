import { requestWorkJson } from "./work-transport";
import type { WorkOverview, WorkEvent } from "../types";

export function readWorkOverview(offset = 0, signal?: AbortSignal): Promise<WorkOverview> {
  return requestWorkJson(`/api/work-runs/overview?limit=100&offset=${offset}`, { signal });
}

export async function readWorkEvents(id: string, signal?: AbortSignal): Promise<WorkEvent[]> {
  const result = await requestWorkJson<{ events: WorkEvent[] }>(
    `/api/work-runs/${encodeURIComponent(id)}/events`, { signal },
  );
  return result.events;
}
