import { useEffect } from 'react'
import { useDiffReviewStore } from 'ia-sparta-core'
import { useEventBus } from 'ia-sparta-core'
import type { DiffProposedEvent } from 'ia-sparta-core'

/**
 * DiffProposalDialog — bridges the backend permission_broker events into
 * the diff-review store queue. Enqueues proposals into useDiffReviewStore,
 * which AgentActivityPanel displays for user review.
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

  return null
}
