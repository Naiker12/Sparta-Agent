/**
 * ia-sparta-stream-events — Handler para eventos de tool_call
 *
 * Responsabilidad ÚNICA: procesar eventos de tipo 'tool_call'.
 */
import type { ToolCallEvent } from '../event-types'

export function handleToolCallEvent(event: ToolCallEvent): void {
  // Lógica específica para tool calls
}