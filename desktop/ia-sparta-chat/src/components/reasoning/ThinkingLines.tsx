import { useRef, useEffect } from 'react'
import { StreamCursor } from './StreamCursor'

interface ThinkingLinesProps {
  text: string
  isStreaming?: boolean
}

export function ThinkingLines({ text, isStreaming = false }: ThinkingLinesProps) {
  const linesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (linesEndRef.current && isStreaming) {
      linesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [text, isStreaming])

  if (!text || !text.trim()) return null

  return (
    <div
      style={{
        fontSize: 12,
        lineHeight: 1.6,
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-ui)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        padding: '2px 0',
      }}
    >
      {text}
      {isStreaming && <StreamCursor visible />}
      <div ref={linesEndRef} />
    </div>
  )
}