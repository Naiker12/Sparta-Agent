export type AutomationRunSnapshot = { id: string; status: string; output?: string; error?: string };

/** One serial request per thread, regardless of how many views consume it. */
export function createRunPoller(
  fetchRun: (threadId: string) => Promise<AutomationRunSnapshot>,
  delay: () => number,
) {
  type Listener = (run: AutomationRunSnapshot) => void | Promise<void>;
  type Entry = {
    listeners: Set<Listener>; stopped: boolean; busy?: boolean; wake?: () => void;
    timer?: ReturnType<typeof setTimeout>; last?: AutomationRunSnapshot;
  };
  const entries = new Map<string, Entry>();
  function subscribe(threadId: string, listener: Listener) {
    let entry = entries.get(threadId);
    if (entry) {
      entry.listeners.add(listener);
      if (entry.last && entry.last.status !== "running") {
        void Promise.resolve().then(() => {
          if (!entry!.stopped && entry!.listeners.has(listener)) return listener(entry!.last!);
        }).catch(() => undefined);
      }
    } else {
      entry = { listeners: new Set([listener]), stopped: false };
      entries.set(threadId, entry);
      const current = entry;
      async function poll() {
        if (current.stopped || current.busy) return;
        current.busy = true;
        let terminal = false;
        try {
          const run = await fetchRun(threadId);
          if (current.stopped) return;
          current.last = run;
          terminal = run.status !== "running";
          await Promise.allSettled([...current.listeners].map(async (callback) => {
            if (!current.stopped && current.listeners.has(callback)) await callback(run);
          }));
        } catch {
          // Keep the last checkpoint; failures never end an active subscription.
        } finally {
          current.busy = false;
          if (!current.stopped && !terminal) current.timer = setTimeout(() => void poll(), delay());
        }
      }
      current.wake = () => {
        if (current.last && current.last.status !== "running") return;
        clearTimeout(current.timer);
        void poll();
      };
      void poll();
    }
    const current = entry;
    return () => {
      current.listeners.delete(listener);
      if (current.listeners.size === 0) {
        current.stopped = true;
        clearTimeout(current.timer);
        if (entries.get(threadId) === current) entries.delete(threadId);
      }
    };
  }
  return Object.assign(subscribe, {
    refresh: () => { for (const entry of entries.values()) entry.wake?.(); },
  });
}
