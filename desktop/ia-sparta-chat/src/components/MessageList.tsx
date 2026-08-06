import { useRef } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { Message } from 'ia-sparta-core'
import { useChatStore } from 'ia-sparta-core'
import { MessageBubble } from './MessageBubble'
import { cn } from 'ia-sparta-core'

interface MessageListProps {
  messages: Message[]
  className?: string
}

export function MessageList({ messages, className }: MessageListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const isStreaming = useChatStore((s) => s.isStreaming)

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

  return (
    <div className={cn('min-h-0 h-full w-full', className)}>
      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
        followOutput={(isAtBottom) => (isStreaming ? 'smooth' : isAtBottom ? 'auto' : false)}
        alignToBottom
        style={{ height: '100%', width: '100%' }}
        components={{
          Header: () => <div style={{ height: 20 }} />,
          Footer: () => <div style={{ height: 40 }} />,
        }}
        itemContent={(_index, msg) => (
          <div
            style={{
              padding: '14px max(24px, calc(50% - 440px))',
            }}
          >
            <MessageBubble
              key={msg.id}
              message={msg}
              isLastUser={msg.role === 'user' && msg.id === lastUserMsgId}
              isLastAssistant={msg.role === 'assistant' && msg.id === lastAssistantMsgId}
            />
          </div>
        )}
      />
    </div>
  )
}
