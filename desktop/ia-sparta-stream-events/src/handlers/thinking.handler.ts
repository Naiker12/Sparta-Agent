/**
 * ia-sparta-stream-events — Handler para eventos de thinking
 *
 * Responsabilidad ÚNICA: procesar eventos de tipo 'thinking'.
 */
import type { ThinkingEvent } from '../event-types'

export function handleThinkingEvent(event: ThinkingEvent): void {
  // Lógica específica para eventos de thinking
  // (separada del hook principal para mantener responsabilidad única)
}