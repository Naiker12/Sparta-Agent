import { useEffect } from 'react'
import { useDiffReviewStore } from 'ia-sparta-core'
import { useEventBus } from 'ia-sparta-core'
import type { DiffProposedEvent } from 'ia-sparta-core'

/**
 * DiffProposalDialog — bridges the backend permission_broker events into
 * the diff-review store queue. No longer renders a modal directly; instead
 * it enqueues proposals into useDiffReviewStore, which DiffReviewTab
 * (mounted inside EditorPanel) displays as an inline Monaco DiffEditor tab.
 *
 * This fixes bug 1.1 (parallel tool calls overwriting each other) because
 * the store uses a queue instead of a single useState slot.
 */
export function DiffProposalDialog() {
  const enqueue = useDiffReviewStore((s) => s.enqueue)

  useEffect(() => {
    const unsub = useEventBus.getState().subscribe((event) => {
      if (event.type === 'editor:diff_proposed') {
        const e = event as unknown as DiffProposedEvent
        enqueue({
          requestId: e.requestId,
          filePath: e.filePath,
          originalContent: e.originalContent,
          newContent: e.newContent,
          language: e.language,
          status: 'pending',
        })
      }
    })
    return unsub
  }, [enqueue])

  // No DOM rendered — the actual UI is in DiffReviewTab
  return null
}