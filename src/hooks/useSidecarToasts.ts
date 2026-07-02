import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useEventBus } from '@/stores/event-bus.store'
import type { SpartaEvent } from '@/types'

const ERROR_EVENTS: SpartaEvent['type'][] = [
  'agent:error',
  'stream:error',
  'tool:error',
  'mcp:disconnected',
]

function getErrorMessage(event: SpartaEvent): string {
  switch (event.type) {
    case 'agent:error':
      return event.error ?? 'Ocurrió un error en el agente.'
    case 'stream:error':
      return event.error ?? 'Error durante la generación de la respuesta.'
    case 'tool:error':
      return event.error ?? (event.toolName
        ? `Error al ejecutar la herramienta ${event.toolName}.`
        : 'Error al ejecutar una herramienta.')
    case 'mcp:disconnected':
      return `Se desconectó el servidor MCP ${event.serverId}.`
    default:
      return 'Ocurrió un error inesperado.'
  }
}

function sanitizeForToast(message: string): string {
  return message
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220)
}

export function useSidecarToasts() {
  const { subscribe } = useEventBus()
  const lastShown = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    const unsub = subscribe((event) => {
      if (!ERROR_EVENTS.includes(event.type)) return

      const raw = getErrorMessage(event as SpartaEvent)
      const message = sanitizeForToast(raw)
      const requestId = 'requestId' in event ? (event as SpartaEvent & { requestId?: string }).requestId : undefined
      const dedupeKey = requestId ?? 'global'

      if (lastShown.current.get(dedupeKey) === message) return
      lastShown.current.set(dedupeKey, message)

      toast.error('Error de Sparta', {
        description: message,
        id: `sparta-error-${dedupeKey}`,
      })
    })
    return unsub
  }, [subscribe])
}
