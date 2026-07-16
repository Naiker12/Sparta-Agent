/**
 * ia-sparta-stream-events — TraceEvent unificado y hook useStreamEvents
 *
 * Responsabilidad ÚNICA: hook principal que orquesta los handlers.
 * No contiene lógica de formateo ni de estado — solo enrutamiento.
 */
import { useCallback } from 'react'
import type { TraceEvent, ThinkingEvent, ToolCallEvent, PlanEvent, TextDeltaEvent } from './event-types'
import { handleThinkingEvent } from './handlers/thinking.handler'
import { handleToolCallEvent } from './handlers/tool-call.handler'
import { handlePlanEvent } from './handlers/plan.handler'
import { handleTextDeltaEvent } from './handlers/text-delta.handler'

export function useStreamEvents() {
  const dispatchEvent = useCallback((event: TraceEvent) => {
    switch (event.type) {
      case 'thinking':
        handleThinkingEvent(event as ThinkingEvent)
        break
      case 'tool_call':
        handleToolCallEvent(event as ToolCallEvent)
        break
      case 'plan':
        handlePlanEvent(event as PlanEvent)
        break
      case 'text_delta':
        handleTextDeltaEvent(event as TextDeltaEvent)
        break
      default:
        break
    }
  }, [])

  return { dispatchEvent }
}