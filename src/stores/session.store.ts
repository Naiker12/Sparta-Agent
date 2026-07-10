import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session } from '@/types'

interface SessionState {
  sessions: Session[]
  activeSessionId: string | null

  createSession: (title?: string, model?: string, providerId?: string) => string
  switchSession: (id: string) => void
  resetActiveSession: () => void
  deleteSession: (id: string) => void
  pinSession: (id: string) => void
  archiveSession: (id: string) => void
  renameSession: (id: string, newTitle: string) => void
  updateSessionModel: (id: string, model: string) => void
  updateSessionMeta: (id: string, updater: Partial<Session>) => void
  addReasoningTokens: (id: string, tokens: number) => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessions: [],
      activeSessionId: null,

      createSession: (title, model, providerId) => {
        const id = crypto.randomUUID()
        const session: Session = {
          id,
          title: title || 'Nueva conversación',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: model || '',
          providerId,
          messageCount: 0,
        }
        set((s) => ({
          sessions: [session, ...s.sessions],
          activeSessionId: id,
        }))
        return id
      },

      switchSession: (id) => set({ activeSessionId: id }),

      resetActiveSession: () => set({ activeSessionId: null }),

      deleteSession: (id) =>
        set((s) => {
          const wasActive = s.activeSessionId === id
          return {
            sessions: s.sessions.filter((sess) => sess.id !== id),
            activeSessionId: wasActive ? null : s.activeSessionId,
          }
        }),

      pinSession: (id) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === id ? { ...sess, pinned: !sess.pinned } : sess
          ),
        })),

      archiveSession: (id) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === id ? { ...sess, archived: !sess.archived } : sess
          ),
        })),

      renameSession: (id, newTitle) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === id ? { ...sess, title: newTitle } : sess
          ),
        })),

      updateSessionModel: (id, model) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === id ? { ...sess, model } : sess
          ),
        })),

      updateSessionMeta: (id, updater) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === id ? { ...sess, ...updater, updatedAt: Date.now() } : sess
          ),
        })),
      addReasoningTokens: (id, tokens) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === id ? { ...sess, reasoningTokens: (sess.reasoningTokens ?? 0) + tokens } : sess
          ),
        })),
    }),
    {
      name: 'sparta-session',
      version: 1,
      partialize: (state) => ({
        sessions: state.sessions,
      }),
    }
  )
)