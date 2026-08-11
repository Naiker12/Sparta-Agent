export interface SpartaEventEnvelope<T> {
  eventId: string
  sequence: number
  timestamp: number
  type: string
  payload: T
  sessionId?: string
  messageId?: string
  taskId?: string
  agentId?: string
}
