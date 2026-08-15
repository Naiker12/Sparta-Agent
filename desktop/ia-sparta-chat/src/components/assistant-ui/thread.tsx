import type { Message } from 'ia-sparta-core'
import { MessageList } from '../MessageList'

export interface ThreadProps {
  messages: Message[]
  isStreaming?: boolean
  onSendMessage?: (content: string) => void
}

export function Thread({ messages }: ThreadProps) {
  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-base)]">
      <MessageList messages={messages} />
    </div>
  )
}
