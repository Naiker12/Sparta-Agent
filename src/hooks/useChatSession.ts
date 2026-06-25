import { useChatStore } from '@/stores/chat.store'

export function useChatSession() {
  const store = useChatStore()

  return {
    sessions: store.sessions,
    activeSessionId: store.activeSessionId,
    messages: store.getActiveMessages(),
    isStreaming: store.isStreaming,
    createSession: store.createSession,
    switchSession: store.switchSession,
    deleteSession: store.deleteSession,
    addMessage: store.addMessage,
    updateMessage: store.updateMessage,
    setStreaming: store.setStreaming,
  }
}
