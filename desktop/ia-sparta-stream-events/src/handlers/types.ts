export interface EventHandlerCtx {
  event: Record<string, unknown>
  sid: string
  mid: string
}
