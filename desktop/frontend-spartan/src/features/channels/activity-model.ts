import type { ChannelOverview } from "./types";
export type ActivityCategory = "responses" | "errors" | "connections" | "other";
export type ActivityFilter = "all" | Exclude<ActivityCategory, "other">;
const eventTypes = {
  reply_sent: ["responses", "replySent"],
  reply_failed: ["errors", "replyFailed"],
  request_started: ["other", "requestStarted"],
  request_cancelled: ["other", "requestCancelled"],
  web_search_started: ["other", "webSearchStarted"],
  web_search_completed: ["other", "webSearchCompleted"],
  web_search_unavailable: ["other", "webSearchUnavailable"],
  credentials_error: ["errors", "credentialsError"],
  consumer_conflict: ["errors", "consumerConflict"],
  rate_limited: ["errors", "rateLimited"],
  transport_error: ["errors", "transportError"],
  connection_saved: ["connections", "saved"],
  connection_requested: ["connections", "requested"],
  connection_paused: ["connections", "paused"],
  connected: ["connections", "connected"],
  pairing_started: ["connections", "pairingStarted"],
  pairing_approved: ["connections", "pairingApproved"],
  pairing_cancelled: ["connections", "pairingCancelled"],
  context_reset: ["connections", "contextReset"],
} as const;
export function activityType(code: string) {
  return (
    eventTypes[code as keyof typeof eventTypes] ??
    (["other", "unknown"] as const)
  );
}
export function filterActivity(
  events: ChannelOverview["events"],
  account: string,
  category: ActivityFilter,
) {
  return events.filter(
    (event) =>
      (account === "all" || account === event.account_id) &&
      (category === "all" || activityType(event.code)[0] === category),
  );
}
export function activityCounts(events: ChannelOverview["events"]) {
  return events.reduce(
    (counts, event) => {
      counts[activityType(event.code)[0]] += 1;
      return counts;
    },
    { responses: 0, errors: 0, connections: 0, other: 0 },
  );
}
