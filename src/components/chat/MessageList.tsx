import { useEffect, useRef } from 'react'
import type { Message } from '@/types'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: Message[]
  isStreaming?: boolean
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div ref={scrollRef} style={{
      flex: 1,
      overflowY: 'auto',
      padding: '12px max(20px, calc(50% - 320px))',
    }}>
      <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4 }}>
            <span style={{
              width: 6, height: 6,
              background: 'var(--status-think)',
              borderRadius: '50%',
              animation: 'pulse 1.2s ease infinite',
            }} />
            <span style={{
              width: 6, height: 6,
              background: 'var(--status-think)',
              borderRadius: '50%',
              animation: 'pulse 1.2s ease infinite',
              animationDelay: '0.15s',
            }} />
            <span style={{
              width: 6, height: 6,
              background: 'var(--status-think)',
              borderRadius: '50%',
              animation: 'pulse 1.2s ease infinite',
              animationDelay: '0.30s',
            }} />
          </div>
        )}
      </div>
    </div>
  )
}
