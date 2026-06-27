import { useEffect, useRef } from 'react'
import type { Message } from '@/types'
import { MessageBubble } from './MessageBubble'

import { cn } from '@/lib/utils'

interface MessageListProps {
  messages: Message[]
  className?: string
}

export function MessageList({ messages, className }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const lastUserMsgId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].id
    }
    return null
  })()

  return (
    <div ref={scrollRef} className={cn('min-h-0', className)} style={{
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
