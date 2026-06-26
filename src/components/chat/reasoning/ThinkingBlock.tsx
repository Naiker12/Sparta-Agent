import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ChevronRightIcon, SparklesIcon, Loader2, Check, X, Globe, Brain } from 'lucide-react'
import { StreamCursor } from './StreamCursor'
import type { ToolCall } from '@/interfaces'

interface ThinkingBlockProps {
  content: string
  isStreaming: boolean
  durationMs?: number
  className?: string
  liveToolCalls?: ToolCall[]
}

const toolIcons: Record<string, React.ReactNode> = {
  web_search: <Globe size={12} strokeWidth={2} />,
  reasoning: <Brain size={12} strokeWidth={2} />,
}

function ToolStatusIcon({ status }: { status: ToolCall['status'] }) {
  if (status === 'running')
    return <Loader2 size={12} strokeWidth={2} style={{ color: 'var(--status-warn)', animation: 'spin 1s linear infinite' }} />
  if (status === 'completed')
    return <Check size={12} strokeWidth={2.5} style={{ color: 'var(--status-ok)' }} />
  return <X size={12} strokeWidth={2.5} style={{ color: 'var(--status-err)' }} />
}

function getToolLabel(tc: ToolCall): string {
  if (tc.toolName === 'web_search') {
    const query = typeof tc.input === 'object' && tc.input !== null
      ? (tc.input as any).query ?? JSON.stringify(tc.input)
      : String(tc.input)
    return `Buscando: "${query}"`
  }
  return tc.toolName
}

export function ThinkingBlock({ content, isStreaming, durationMs, className, liveToolCalls = [] }: ThinkingBlockProps) {
  const [userExpanded, setUserExpanded] = useState(true)
  const [autoCollapsed, setAutoCollapsed] = useState(false)
  const prevStreaming = useRef(isStreaming)
  const contentEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prevStreaming.current && !isStreaming && content) {
      const timer = setTimeout(() => setAutoCollapsed(true), 300)
      prevStreaming.current = isStreaming
      return () => clearTimeout(timer)
    }
    if (isStreaming) {
      setAutoCollapsed(false)
      setUserExpanded(true)
    }
    prevStreaming.current = isStreaming
  }, [isStreaming, content])

  useEffect(() => {
    if (contentEndRef.current && isStreaming) {
      contentEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [content, isStreaming])

  const isExpanded = isStreaming || (userExpanded && !autoCollapsed)
  const label = !isStreaming && durationMs !== undefined
    ? `Pensó durante ${(durationMs / 1000).toFixed(1)}s`
    : 'Thinking'

  return (
    <motion.div
      layout
      className={cn('rounded-sm border border-[#2A2A35] bg-bg-surface overflow-hidden', className)}
    >
      <button
        onClick={() => {
          if (!isStreaming) {
            setUserExpanded((v) => !v)
            setAutoCollapsed(false)
          }
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-status-thinking hover:bg-bg-elevated transition-colors"
        style={{ cursor: isStreaming ? 'default' : 'pointer' }}
      >
        <ChevronRightIcon className={cn('size-3 transition-transform', isExpanded && 'rotate-90')} />
        <SparklesIcon className="size-3" />
        <span className="font-medium">{label}</span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="thinking-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-[#2A2A35] px-3 py-2" style={{ maxHeight: 240, overflowY: 'auto' }}>
              {content && (
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: isStreaming ? 'var(--text-muted)' : 'var(--text-secondary)', opacity: isStreaming ? 0.7 : 1, fontStyle: isStreaming ? 'italic' : 'normal' }}>
                  {content}
                </p>
              )}

              {liveToolCalls.length > 0 && (
                <div style={{ marginTop: content ? 6 : 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {liveToolCalls.map((tc) => (
                    <div
                      key={tc.id}
                      className="thinking-tool-line"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        fontFamily: 'var(--font-ui)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {toolIcons[tc.toolName] || <SparklesIcon size={12} strokeWidth={1.5} />}
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getToolLabel(tc)}
                      </span>
                      <ToolStatusIcon status={tc.status} />
                    </div>
                  ))}
                </div>
              )}

              {isStreaming && <StreamCursor visible />}
              <div ref={contentEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
