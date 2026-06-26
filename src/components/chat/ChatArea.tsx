import { useChatStore } from '@/stores/chat.store'
import { MessageList } from './MessageList'
import { ChatInput } from '@/components/input/ChatInput'
import { HeroScreen } from './HeroScreen'

export function ChatArea() {
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const messagesBySession = useChatStore((s) => s.messagesBySession)
  const messages = activeSessionId ? (messagesBySession[activeSessionId] ?? []) : []

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {messages.length > 0 ? (
        <MessageList messages={messages} />
      ) : (
        <HeroScreen />
      )}
      <ChatInput />
    </div>
  )
}
