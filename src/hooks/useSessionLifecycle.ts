import { useCallback } from 'react'
import { useSessionStore } from '@/stores/session.store'
import { useChatStore } from '@/stores/chat.store'

export function useSessionLifecycle() {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const createSession = useSessionStore((s) => s.createSession)
  const switchSession = useSessionStore((s) => s.switchSession)
  const _deleteSession = useSessionStore((s) => s.deleteSession)
  const deleteSessionMessages = useChatStore((s) => s.deleteSessionMessages)

  const deleteSession = useCallback((id: string) => {
    _deleteSession(id)
    deleteSessionMessages(id)
  }, [_deleteSession, deleteSessionMessages])

  return {
    sessions,
    activeSessionId,
    createSession,
    switchSession,
    deleteSession,
  }
}
