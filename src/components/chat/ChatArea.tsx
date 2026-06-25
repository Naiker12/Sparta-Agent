import { useChatStore } from '@/stores/chat.store'
import { HeroScreen } from './HeroScreen'
import { MessageList } from './MessageList'
import { ChatInput } from '@/components/input/ChatInput'

export function ChatArea() {
  const { getActiveMessages, isStreaming } = useChatStore()
  const messages = getActiveMessages()
  const hasMessages = messages.length > 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {hasMessages ? (
        <>
          <MessageList messages={messages} isStreaming={isStreaming} />
          <ChatInput />
        </>
      ) : (
        <>
          <HeroScreen />
          <ChatInput />
        </>
      )}
    </div>
  )
}
