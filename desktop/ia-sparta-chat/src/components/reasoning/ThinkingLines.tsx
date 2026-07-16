import { useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { StreamCursor } from './StreamCursor'

const PREVIEW_MAX_LINES = 15
const PREVIEW_MAX_CHARS = 200

function lineIcon(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('search') || lower.includes('busca')) return '\ud83d\udd0d'
  if (lower.includes('read') || lower.includes('lee') || lower.includes('archivo')) return '\ud83d\udcc4'
  if (lower.includes('plan') || lower.includes('analiz') || lower.includes('razon')) return '\ud83e\udde0'
  if (lower.includes('execut') || lower.includes('ejecut') || lower.includes('run')) return '\u26a1'
  if (lower.includes('done') || lower.includes('complet') || lower.includes('finish')) return '\u2713'
  return '\u2192'
}

interface ThinkingLinesProps {
  text: string
  isStreaming?: boolean
  showFullContent?: boolean
  onToggleShowFull?: () => void
}

export function ThinkingLines({ text, isStreaming = false, showFullContent = false, onToggleShowFull }: ThinkingLinesProps) {
  const linesEndRef = useRef<HTMLDivElement>(null)

  const lines = useMemo(() => {
    if (!text) return []
    return text.split('\n').filter(Boolean).map((line, i) => ({
      id: `think-line-${i}`,
      icon: lineIcon(line),
      text: line,
    }))
  }, [text])

  const isLong = lines.length > PREVIEW_MAX_LINES || text.length > PREVIEW_MAX_CHARS
  const showingLines = useMemo(() => {
    if (showFullContent || isStreaming) return lines
    return isLong ? lines.slice(0, PREVIEW_MAX_LINES) : lines
  }, [lines, showFullContent, isStreaming, isLong])

  useEffect(() => {
    if (linesEndRef.current && isStreaming)
      linesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [showingLines.length, isStreaming])

  if (lines.length === 0 && !text) return null

  return (
    <div className="thinking-lines-v2">
      {showingLines.length > 0 && (
        <AnimatePresence initial={false}>
          {showingLines.map((line, idx) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="thinking-line"
            >
              <span className="thinking-line-icon">{line.icon}</span>
              <span className="thinking-line-text">
                {line.text}
                {idx === showingLines.length - 1 && isStreaming && <StreamCursor visible />}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
      <div ref={linesEndRef} />

      {!isStreaming && showingLines.length === 0 && text && (
        <div className="thinking-line">
          <span className="thinking-line-icon">{'\u2713'}</span>
          <span className="thinking-line-text">{text}</span>
        </div>
      )}

      {isLong && !isStreaming && onToggleShowFull && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleShowFull() }}
          className="thinking-expand-btn"
        >
          {showFullContent
            ? 'Mostrar menos'
            : `Mostrar todas (${lines.length} líneas)`}
        </button>
      )}
    </div>
  )
}