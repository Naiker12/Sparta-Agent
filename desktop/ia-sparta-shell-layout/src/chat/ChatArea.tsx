import { useSessionTabsStore, useChatStore } from 'ia-sparta-core'
import { HeroScreen, ChatInput } from 'ia-sparta-chat'
import { ChatPane } from './ChatPane'

const MAX_LIVE_TABS = 4

export function ChatArea() {
  const openTabs = useSessionTabsStore((s) => s.openTabs)
  const focusedTabId = useSessionTabsStore((s) => s.focusedTabId)
  const streamingBySession = useChatStore((s) => s.streamingBySession)

  if (openTabs.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <HeroScreen />
        <ChatInput className="shrink-0 px-4 py-3" />
      </div>
    )
  }

  const liveSessionIds: string[] = []
  for (const id of openTabs) {
    if (streamingBySession[id]?.isStreaming) {
      liveSessionIds.push(id)
    } else if (liveSessionIds.length < MAX_LIVE_TABS) {
      liveSessionIds.push(id)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden relative">
      {openTabs.map((sid) => {
        const isLive = liveSessionIds.includes(sid)
        const isFocused = sid === focusedTabId
        return (
          <div
            key={sid}
            className="absolute inset-0 flex flex-col"
            style={{ display: isFocused ? 'flex' : 'none' }}
          >
            {isLive ? (
              <ChatPane sessionId={sid} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                  Pestaña inactiva — haz clic para reactivar
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
