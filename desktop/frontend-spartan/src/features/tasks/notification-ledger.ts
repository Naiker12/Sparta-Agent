type StorageLike = Pick<Storage, "getItem" | "setItem">;
type Watermark = { timestamp: number; ids: string[] };
const fallback = new Map<string, Watermark>();

/** Persist before displaying: reloading must never replay the boundary event. */
export function notificationLedger(storage: StorageLike, subject: string, startup: number) {
  const key = `sparta.automation-notifications.v2.${subject}`;
  let state: Watermark = fallback.get(key) ?? { timestamp: startup, ids: [] };
  try {
    const raw = storage.getItem(key);
    if (raw) {
      const saved = JSON.parse(raw) as Watermark;
      if (Number.isFinite(saved.timestamp) && Array.isArray(saved.ids)) state = saved;
    } else {
      const old = Number(storage.getItem(`sparta.automation-notifications.${subject}`));
      // The legacy cursor was inclusive and did not remember IDs. Start strictly
      // after it so the already completed task cannot be shown again.
      if (old > 0) state = { timestamp: old + 1, ids: [] };
    }
  } catch { /* In-memory fallback still handles component remounts. */ }
  return {
    get cursor() { return state.timestamp; },
    consume(id: string, timestamp: number): boolean {
      const latest = fallback.get(key);
      if (latest && latest.timestamp >= state.timestamp) state = latest;
      if (timestamp < state.timestamp || (timestamp === state.timestamp && state.ids.includes(id))) return false;
      state = { timestamp, ids: timestamp === state.timestamp ? [...state.ids, id] : [id] };
      fallback.set(key, state);
      try { storage.setItem(key, JSON.stringify(state)); } catch { /* Storage can be unavailable. */ }
      return true;
    },
  };
}
