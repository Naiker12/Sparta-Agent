/**
 * ia-sparta-stream-events — Tipos de evento unificados
 *
 * Responsabilidad ÚNICA: definir TODOS los tipos de evento de streaming
 * en un solo lugar. Separado de los handlers para evitar imports circulares.
 * Reemplaza src/types/events.ts (486 líneas) con tipos enfocados.
 */

export type StreamEventType =
  | 'thinking'
  | 'tool_call'
  | 'plan'
  | 'text_delta'
  | 'stream:error'
  | 'stream:completed'
  | 'stream_end'
  | 'error'

export interface TraceEventBase {
  sessionId: string
  messageId: string
  type: StreamEventType
  timestamp: number
}

export interface ThinkingEvent extends TraceEventBase {
  type: 'thinking'
  content: string
}

export interface ToolCallEvent extends TraceEventBase {
  type: 'tool_call'
  toolName: string
  toolInput: Record<string, unknown>
  toolCallId: string
}

export interface PlanEvent extends TraceEventBase {
  type: 'plan'
  steps: string[]
  currentStep: number
}

export interface TextDeltaEvent extends TraceEventBase {
  type: 'text_delta'
  delta: string
}

export interface StreamErrorEvent extends TraceEventBase {
  type: 'stream:error'
  error: string
}

export interface StreamCompletedEvent extends TraceEventBase {
  type: 'stream:completed'
}

export type TraceEvent =
  | ThinkingEvent
  | ToolCallEvent
  | PlanEvent
  | TextDeltaEvent
  | StreamErrorEvent
  | StreamCompletedEvent