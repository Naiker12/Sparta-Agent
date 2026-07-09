import { useEffect, useRef } from 'react'
import type { Message } from '@/types'
import { useChatStore } from '@/stores/chat.store'
import { MessageBubble } from './MessageBubble'
import { SearchProgressBlock } from './reasoning/SearchProgressBlock'

import { cn } from '@/lib/utils'

function _isSearchTool(toolName: string) {
  const n = toolName.toLowerCase()
  return n === 'web_search' || n === 'web_search_tool' || n.includes('web_search') || n.includes('search_tool')
}

interface MessageListProps {
  messages: Message[]
  className?: string
}

function findActiveSearchProgress(messages: Message[]) {
  for (const msg of messages) {
    const items = msg.searchProgress ?? []
    const hasRunningSearch = msg.toolCalls?.some(
      (tc) => _isSearchTool(tc.toolName) && tc.status === 'running'
    )
    if (items.length > 0 || hasRunningSearch) {
      return {
        items,
        isActive: hasRunningSearch ?? false,
        query: msg.searchQuery,
        sessionId: msg.sessionId,
        messageId: msg.id,
      }
    }
  }
  return null
}

export function MessageList({ messages, className }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const userScrolledUp = useRef(false)

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    userScrolledUp.current = !atBottom
  }

  useEffect(() => {
    if (userScrolledUp.current) return
    const el = scrollRef.current
    if (!el) return
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(raf)
  }, [messages, isStreaming])

  const lastUserMsgId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].id
    }
    return null
  })()

  const lastAssistantMsgId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return null
  })()

  const activeSearch = findActiveSearchProgress(messages)

  return (
    <div ref={scrollRef} onScroll={handleScroll} className={cn('min-h-0', className)} style={{
      padding: '12px max(20px, calc(50% - 320px))',
    }}>
      {/* Sticky search progress — visible at top while scrolling */}
      {activeSearch && (
        <div
          className="sticky top-0 z-20"
          style={{
            margin: '0 -8px',
            padding: '8px 8px 4px',
            background: 'var(--bg-primary)',
          }}
        >
          <SearchProgressBlock
            items={activeSearch.items}
            isActive={activeSearch.isActive}
            query={activeSearch.query}
            onCancel={() => {
              const sid = activeSearch.sessionId
              if (sid) {
                useChatStore.getState().stopStreaming(sid)
              }
            }}
            onRetry={() => {}}
          />
        </div>
      )}

      <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isLastUser={msg.role === 'user' && msg.id === lastUserMsgId}
            isLastAssistant={msg.role === 'assistant' && msg.id === lastAssistantMsgId}
            hideSearchProgress={activeSearch?.messageId === msg.id}
          />
        ))}
      </div>
    </div>
  )
}
