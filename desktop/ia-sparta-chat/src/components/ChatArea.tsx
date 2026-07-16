import { useChatStore } from '@/stores/chat.store'
import { useSessionStore } from '@/stores/session.store'
import { MessageList } from './MessageList'
import { ChatInput } from '@/components/input/ChatInput'
import { HeroScreen } from './HeroScreen'
import { PlanWatchPane } from '@/components/agents/PlanWatchPane'

export function ChatArea() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const messagesBySession = useChatStore((s) => s.messagesBySession)
  const messages = activeSessionId ? (messagesBySession[activeSessionId] ?? []) : []

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {messages.length > 0 ? (
        <MessageList className="flex-1 min-h-0 overflow-y-auto" messages={messages} />
      ) : (
        <HeroScreen />
      )}
      <div style={{ padding: '0 16px 6px' }}>
        <PlanWatchPane />
      </div>
      <ChatInput className="shrink-0 px-4 py-3" />
    </div>
  )
}
