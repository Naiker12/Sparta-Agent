/**
 * ia-sparta-stream-events — Handler para eventos de text_delta
 *
 * Responsabilidad ÚNICA: procesar eventos de tipo 'text_delta'.
 */
import type { TextDeltaEvent } from '../event-types'

export function handleTextDeltaEvent(_event: TextDeltaEvent): void {
  // Lógica específica para deltas de texto
}