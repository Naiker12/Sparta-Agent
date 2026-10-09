/** Keep active runs responsive; quiet accounts need fewer database reads. */
export function notificationPollDelay(active: boolean | undefined, eventCount: number, failures: number) {
  if (failures > 0) return Math.min(30000, 2000 * 2 ** Math.min(failures, 4));
  // Older servers omit active: retain their existing polling frequency.
  return active !== false || eventCount >= 100 ? 2000 : 10000;
}
