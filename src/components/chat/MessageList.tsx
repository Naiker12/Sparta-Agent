import { useEffect, useRef } from 'react'
import type { Message } from '@/types'
import { useChatStore } from '@/stores/chat.store'
import { MessageBubble } from './MessageBubble'

import { cn } from '@/lib/utils'

interface MessageListProps {
  messages: Message[]
  className?: string
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

  return (
    <div ref={scrollRef} onScroll={handleScroll} className={cn('min-h-0', className)} style={{
      padding: '12px max(20px, calc(50% - 320px))',
    }}>
      <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isLastUser={msg.role === 'user' && msg.id === lastUserMsgId} />
        ))}
      </div>
    </div>
  )
}
