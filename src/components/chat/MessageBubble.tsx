import type { Message } from '@/types'
import { ThinkingBlock } from './reasoning/ThinkingBlock'
import { PipelineTrace } from './reasoning/PipelineTrace'
import { MessageActionsMenu } from './MessageActionsMenu'
import spartaIcon from '@/assets/sparta-icon.png'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className="message-row"
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        position: 'relative',
      }}
    >
      <div
        style={{
          maxWidth: isUser ? 480 : 600,
          width: isUser ? undefined : '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 6,
            justifyContent: isUser ? 'flex-end' : 'flex-start',
          }}
        >
          {!isUser && (
            <>
              <img
                src={spartaIcon}
                alt="Sparta Agent"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 'var(--radius-sm)',
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  fontFamily: 'var(--font-ui)',
                }}
              >
                Sparta Agent
              </span>
            </>
          )}
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <div
            style={{
              opacity: isUser ? 0 : undefined,
            }}
            className="message-actions-slot"
          >
            <MessageActionsMenu message={message} sessionId={message.sessionId} />
          </div>
        </div>

        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.content}
        </div>

        {message.thinking && (
          <div style={{ marginTop: 8 }}>
            <ThinkingBlock content={message.thinking} />
          </div>
        )}

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <PipelineTrace
              steps={message.toolCalls.map((tc) => ({
                id: tc.id,
                name: tc.toolName,
                meta: typeof tc.input === 'string' ? tc.input : undefined,
                status:
                  tc.status === 'completed'
                    ? 'done' as const
                    : tc.status === 'running'
                    ? 'running' as const
                    : 'error' as const,
                durationMs: tc.durationMs,
              }))}
            />
          </div>
        )}
      </div>
    </div>
  )
}
