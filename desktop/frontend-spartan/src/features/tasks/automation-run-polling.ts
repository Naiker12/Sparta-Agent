import { authFetch } from "@/features/auth";
import { createRunPoller } from "./shared-run-poller";

export const subscribeAutomationRun = createRunPoller(async (threadId) => {
  const response = await authFetch(`/api/tasks/runs/by-thread/${encodeURIComponent(threadId)}`);
  if (!response.ok) throw new Error("Automation status unavailable");
  return response.json();
}, () => document.hidden ? 10000 : 1000);

// Restore the visible execution immediately instead of waiting for a hidden tick.
const onVisibility = () => {
  if (!document.hidden) subscribeAutomationRun.refresh();
};
document.addEventListener("visibilitychange", onVisibility);
if (import.meta.hot) {
  import.meta.hot.dispose(() => document.removeEventListener("visibilitychange", onVisibility));
}
