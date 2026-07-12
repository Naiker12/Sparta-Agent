import { create } from 'zustand'

export interface DiffProposal {
  requestId: string
  filePath: string
  originalContent: string
  newContent: string
  language: string
  status: 'pending' | 'approved' | 'rejected'
}

interface DiffReviewState {
  /** Queue of pending proposals (FIFO, user resolves one at a time) */
  queue: DiffProposal[]
  /** Currently active proposal being reviewed */
  activeProposal: DiffProposal | null
  /** Paths that have pending diffs (for tab indicators) */
  pendingPaths: Set<string>

  /** Add a proposal to the queue. If nothing is active, sets it as active. */
  enqueue: (p: DiffProposal) => void
  /** Resolve current proposal by requestId */
  resolve: (requestId: string, approved: boolean) => void
  /** Skip to next pending proposal */
  next: () => void
  /** Remove all proposals for a given path */
  clearForPath: (filePath: string) => void
  /** Clear all proposals */
  clear: () => void
}

export const useDiffReviewStore = create<DiffReviewState>((set) => ({
  queue: [],
  activeProposal: null,
  pendingPaths: new Set(),

  enqueue: (p) => {
    set((s) => {
      // Don't enqueue duplicate requestId
      if (s.queue.some((q) => q.requestId === p.requestId)) return s

      const newQueue = [...s.queue, { ...p, status: 'pending' as const }]
      const pendingPaths = new Set(s.pendingPaths)
      pendingPaths.add(p.filePath)

      return {
        queue: newQueue,
        activeProposal: s.activeProposal ?? newQueue[0],
        pendingPaths,
      }
    })
  },

  resolve: (requestId, approved) => {
    set((s) => {
      const resolved = s.queue.find((q) => q.requestId === requestId)
      if (!resolved) return s

      const updatedQueue = s.queue.map((q) =>
        q.requestId === requestId ? { ...q, status: approved ? 'approved' as const : 'rejected' as const } : q
      )

      // Recalculate pendingPaths
      const pendingPaths = new Set(
        updatedQueue.filter((q) => q.status === 'pending').map((q) => q.filePath)
      )

      // Find next active proposal (first pending)
      const nextPending = updatedQueue.find((q) => q.status === 'pending')

      return {
        queue: updatedQueue,
        activeProposal: nextPending ?? null,
        pendingPaths,
      }
    })
  },

  next: () => {
    set((s) => {
      const nextPending = s.queue.find((q) => q.status === 'pending' && q.requestId !== s.activeProposal?.requestId)
      return { activeProposal: nextPending ?? null }
    })
  },

  clearForPath: (filePath) => {
    set((s) => {
      const newQueue = s.queue.filter((q) => q.filePath !== filePath)
      const pendingPaths = new Set(
        newQueue.filter((q) => q.status === 'pending').map((q) => q.filePath)
      )
      const activeProposal = s.activeProposal?.filePath === filePath
        ? newQueue.find((q) => q.status === 'pending') ?? null
        : s.activeProposal
      return { queue: newQueue, activeProposal, pendingPaths }
    })
  },

  clear: () => set({ queue: [], activeProposal: null, pendingPaths: new Set() }),
}))