import type { QueuedChatRunSettings } from "./queued-chat-run-settings";

/** Full access belongs to the live session, never to recovered work. */
export function durableQueueSettings(settings: QueuedChatRunSettings): QueuedChatRunSettings {
  const snapshot = structuredClone(settings);
  if (snapshot.permissionMode === "full") {
    snapshot.permissionMode = "ask";
    snapshot.confirmToolCalls = true;
  }
  snapshot.bypassPermissions = false;
  return snapshot;
}
