import { useChatStore } from 'ia-sparta-core'
import { MessageList } from 'ia-sparta-chat'
import { ChatInput } from 'ia-sparta-chat'
import { HeroScreen } from 'ia-sparta-chat'
import { PlanWatchPane } from 'ia-sparta-agents'
import { SessionPaneProvider } from './SessionPaneContext'

interface ChatPaneProps {
  sessionId: string
}

export function ChatPane({ sessionId }: ChatPaneProps) {
  const messagesBySession = useChatStore((s) => s.messagesBySession)
  const messages = messagesBySession[sessionId] ?? []

  return (
    <SessionPaneProvider sessionId={sessionId}>
      <div className="flex h-full flex-col overflow-hidden">
        {messages.length > 0 ? (
          <MessageList className="flex-1 min-h-0 overflow-y-auto" messages={messages} />
        ) : (
          <HeroScreen />
        )}
        <div style={{ padding: '0 16px 6px' }}>
          <PlanWatchPane />
        </div>
        <ChatInput sessionId={sessionId} className="shrink-0 px-4 py-3" />
      </div>
    </SessionPaneProvider>
  )
}
