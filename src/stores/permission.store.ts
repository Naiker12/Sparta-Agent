import { create } from 'zustand'

export interface PermissionRequest {
  requestId: string
  tool: string
  path: string
  preview: string
  /** Timestamp when the request arrived — used to expire stale entries */
  arrivedAt: number
}

interface PermissionState {
  /** Queue of pending permission requests — shown one at a time */
  queue: PermissionRequest[]

  enqueue: (req: PermissionRequest) => void
  /** Remove a request from the queue (after user responds or timeout) */
  dequeue: (requestId: string) => void
  /** Clear all pending requests (e.g. on session end) */
  clearAll: () => void
}

export const usePermissionStore = create<PermissionState>((set) => ({
  queue: [],

  enqueue: (req) =>
    set((s) => ({
      // Avoid duplicates
      queue: s.queue.some((r) => r.requestId === req.requestId)
        ? s.queue
        : [...s.queue, req],
    })),

  dequeue: (requestId) =>
    set((s) => ({ queue: s.queue.filter((r) => r.requestId !== requestId) })),

  clearAll: () => set({ queue: [] }),
}))
