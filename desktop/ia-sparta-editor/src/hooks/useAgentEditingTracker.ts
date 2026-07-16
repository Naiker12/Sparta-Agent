import { useState } from 'react'
import { useEventBusListener } from 'ia-sparta-core'

export function useAgentEditingTracker(openFile: (path: string) => void) {
  const [agentEditing, setAgentEditing] = useState<Map<string, string>>(new Map())
  const [agentEditingPaths, setAgentEditingPaths] = useState<Set<string>>(new Set())

  useEventBusListener('tool:called', (data: Record<string, unknown> | unknown) => {
    const evt = data as Record<string, unknown>
    const name = (evt.name ?? evt.toolName ?? '') as string
    const id = (evt.toolCallId ?? evt.tool_call_id ?? evt.id ?? '') as string
    if (!name || !id) return
    const input = evt.input as Record<string, unknown> | undefined
    const filePath = (input?.path ?? input?.file_path ?? '') as string | undefined
    if (!filePath) return

    setAgentEditing((prev) => {
      const next = new Map(prev)
      next.set(id, filePath)
      return next
    })
    setAgentEditingPaths((prev) => {
      const next = new Set(prev)
      next.add(filePath)
      return next
    })

    openFile(filePath)
  })

  useEventBusListener('tool:result', (data: Record<string, unknown> | unknown) => {
    const evt = data as Record<string, unknown>
    const id = (evt.toolCallId ?? evt.tool_call_id ?? evt.id ?? '') as string
    if (!id) return

    const filePath = agentEditing.get(id)
    setAgentEditing((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    if (filePath) {
      setAgentEditingPaths((prev) => {
        const next = new Set(prev)
        const stillEditing = Array.from(agentEditing.values()).filter((p) => p === filePath && p !== id)
        if (stillEditing.length === 0) next.delete(filePath)
        return next
      })
    }
  })

  return { agentEditing, agentEditingPaths }
}
