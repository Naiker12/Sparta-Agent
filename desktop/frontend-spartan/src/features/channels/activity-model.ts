import type { ChannelOverview } from "./types";
export type ActivityCategory = "responses" | "errors" | "connections" | "other";
export type ActivityFilter = "all" | Exclude<ActivityCategory, "other">;
const eventTypes = {
  reply_sent: ["responses", "replySent"],
  reply_failed: ["errors", "replyFailed"],
  request_started: ["other", "requestStarted"],
  request_cancelled: ["other", "requestCancelled"],
  audio_transcription_started: ["other", "audioTranscriptionStarted"],
  audio_transcription_completed: ["other", "audioTranscriptionCompleted"],
  document_read_started: ["other", "documentReadStarted"],
  document_read_completed: ["other", "documentReadCompleted"],
  project_access_updated: ["other", "projectAccessUpdated"],
  project_context_revoked: ["other", "projectContextRevoked"],
  user_access_revoked: ["connections", "userAccessRevoked"],
  profile_updated: ["other", "profileUpdated"],
  document_read_failed: ["other", "documentReadFailed"],
  audio_transcription_failed: ["errors", "audioTranscriptionFailed"],
  voice_preparation_requested: ["connections", "voicePreparationRequested"],
  voice_enabled: ["connections", "voiceEnabled"],
  voice_disabled: ["connections", "voiceDisabled"],
  image_search_started: ["other", "imageSearchStarted"],
  image_search_completed: ["other", "imageSearchCompleted"],
  image_search_unavailable: ["other", "imageSearchUnavailable"],
  photo_sent: ["other", "photoSent"],
  photo_unavailable: ["errors", "photoUnavailable"],
  delivery_cancelled: ["other", "deliveryCancelled"],
  delivery_revoked: ["errors", "deliveryRevoked"],
  web_read_started: ["other", "webReadStarted"],
  web_read_completed: ["other", "webReadCompleted"],
  web_read_unavailable: ["other", "webReadUnavailable"],
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

export function activityPage(
  events: ChannelOverview["events"],
  requestedPage: number,
  pageSize = 8,
) {
  const pages = Math.max(1, Math.ceil(events.length / pageSize));
  const page = Math.min(Math.max(0, requestedPage), pages - 1);
  return {
    page,
    pages,
    events: events.slice(page * pageSize, (page + 1) * pageSize),
  };
}
