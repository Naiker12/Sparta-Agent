/**
 * Local-only microphone activity for visual feedback. This deliberately does
 * not use chat stream events: amplitude is not conversational state and is
 * produced many times per second.
 */
export interface VoiceActivitySnapshot {
  amplitude: number
  isVoiceActive: boolean
  isRecording: boolean
  updatedAt: number
}

let snapshot: VoiceActivitySnapshot = {
  amplitude: 0,
  isVoiceActive: false,
  isRecording: false,
  updatedAt: 0,
}

const listeners = new Set<() => void>()

export function getVoiceActivitySnapshot(): VoiceActivitySnapshot {
  return snapshot
}

export function subscribeVoiceActivity(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishVoiceActivity(next: Omit<VoiceActivitySnapshot, 'updatedAt'>): void {
  snapshot = { ...next, updatedAt: performance.now() }
  listeners.forEach((listener) => listener())
}

export function clearVoiceActivity(): void {
  publishVoiceActivity({ amplitude: 0, isVoiceActive: false, isRecording: false })
}
