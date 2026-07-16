/**
 * usePermissionRequests
 *
 * Subscribes to IPC 'permission:request' events from the Electron main process
 * and feeds them into the permission store so PermissionRequestDialog can render them.
 *
 * Also exposes `respond()` to send the user's decision back to the sidecar.
 */
import { useEffect, useCallback } from 'react'
import { usePermissionStore, type PermissionRequest } from '../stores/permission.store'
import { IS_WEB } from '../lib/env-adapter'

type RememberChoice = 'once' | 'session'

export function usePermissionRequests() {
  const { enqueue, dequeue } = usePermissionStore()

  useEffect(() => {
    if (IS_WEB) return // no permission dialog in web mode

    const unlisten = window.electron?.on(
      'permission:request',
      (payload: unknown) => {
        const p = payload as PermissionRequest & { requestId?: string; request_id?: string; kind?: string }
        const req: PermissionRequest = {
          requestId: p.requestId ?? (p as { request_id?: string }).request_id ?? '',
          tool:      p.tool ?? '',
          path:      p.path ?? '',
          preview:   p.preview ?? '',
          kind:      (p.kind as PermissionRequest['kind']) ?? 'file_access',
          arrivedAt: Date.now(),
        }
        if (req.requestId) {
          enqueue(req)
        }
      },
    )

    return () => { unlisten?.() }
  }, [enqueue])

  const respond = useCallback(
    async (requestId: string, approved: boolean, remember: RememberChoice = 'once') => {
      dequeue(requestId)
      if (!IS_WEB) {
        await (window as any).permission?.respond({ requestId, approved, remember })
      }
    },
    [dequeue],
  )

  return { respond }
}
