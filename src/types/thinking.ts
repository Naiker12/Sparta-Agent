export type ThinkingPhase =
  | 'idle'
  | 'starting'
  | 'analyzing'
  | 'reasoning'
  | 'finishing'
  | 'completed'

export interface ThinkingLine {
  id: string
  icon: string
  text: string
  timestamp: number
}
