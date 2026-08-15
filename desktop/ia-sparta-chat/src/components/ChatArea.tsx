import { useChatStore } from 'ia-sparta-core'
import { useSessionStore } from 'ia-sparta-core'
import { TabStrip } from 'ia-sparta-tabs'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { HeroScreen } from './HeroScreen'
import { PlanWatchPane } from 'ia-sparta-agents'

export function ChatArea() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const messagesBySession = useChatStore((s) => s.messagesBySession)
  const messages = activeSessionId ? (messagesBySession[activeSessionId] ?? []) : []

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Panel Superior de Pestañas (Keep-Alive Multi-Tab) */}
      <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)] shrink-0">
        <TabStrip />
      </div>
      {messages.length > 0 ? (
        <>
          <MessageList className="flex-1 min-h-0 overflow-y-auto" messages={messages} />
          <div style={{ padding: '0 16px 6px' }}>
            <PlanWatchPane />
          </div>
          <ChatInput className="shrink-0 px-4 py-3" />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 overflow-y-auto px-4 py-6">
          <HeroScreen />
          <div className="w-full max-w-3xl px-4 mt-2">
            <ChatInput />
          </div>
        </div>
      )}
    </div>
  )
}
