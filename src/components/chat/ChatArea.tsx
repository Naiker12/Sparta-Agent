import { useChatStore } from '@/stores/chat.store'
import { MessageList } from './MessageList'
import { ChatInput } from '@/components/input/ChatInput'
import { HeroScreen } from './HeroScreen'

export function ChatArea() {
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const messagesBySession = useChatStore((s) => s.messagesBySession)
  const messages = activeSessionId ? (messagesBySession[activeSessionId] ?? []) : []

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {messages.length > 0 ? (
        <MessageList className="flex-1 min-h-0 overflow-y-auto" messages={messages} />
      ) : (
        <HeroScreen />
      )}
      <ChatInput className="shrink-0 px-4 py-3 mb-4" />
    </div>
  )
}
