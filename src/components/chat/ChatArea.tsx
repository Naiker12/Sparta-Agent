import { useChatStore } from '@/stores/chat.store'
import { MessageList } from './MessageList'
import { ChatInput } from '@/components/input/ChatInput'
import { HeroScreen } from './HeroScreen'

export function ChatArea() {
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const messagesBySession = useChatStore((s) => s.messagesBySession)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const messages = activeSessionId ? (messagesBySession[activeSessionId] ?? []) : []

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {messages.length > 0 ? (
        <MessageList messages={messages} isStreaming={isStreaming} />
      ) : (
        <HeroScreen />
      )}
      <ChatInput />
    </div>
  )
}
