import type { ThinkingStatus } from 'ia-sparta-core'

/**
 * Pure function that returns the thinking label text.
 * Consolidates label logic that was previously scattered across
 * ThinkingPill, ThinkingStatusLine, and TimelineBlock.
 *
 * @param status - Current thinking status
 * @param activeLabel - Translated label for active state (e.g. "Pensando")
 * @param completedLabel - Translated label for completed state (e.g. "Pensó")
 */
export function thinkingLabel(
  status: ThinkingStatus,
  activeLabel: string = 'Pensando',
  completedLabel: string = 'Pensó',
): string {
  if (status === 'starting' || status === 'streaming') return activeLabel
  return completedLabel
}
