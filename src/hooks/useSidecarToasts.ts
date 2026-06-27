import { useEffect } from 'react'
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

export function useSidecarToasts() {
  const { subscribe } = useEventBus()

  useEffect(() => {
    const unsub = subscribe((event) => {
      if (!ERROR_EVENTS.includes(event.type)) return

      toast.error('Error de Sparta', {
        description: getErrorMessage(event as SpartaEvent),
      })
    })
    return unsub
  }, [subscribe])
}
