import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRightIcon, SparklesIcon } from 'lucide-react'

interface ThinkingBlockProps {
  content: string
  collapsed?: boolean
  className?: string
}

export function ThinkingBlock({ content, collapsed = false, className }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(!collapsed)

  useEffect(() => {
    if (!collapsed) {
      const timer = setTimeout(() => setExpanded(false), 400)
      return () => clearTimeout(timer)
    }
  }, [collapsed])

  return (
    <div className={cn('rounded-sm border border-[#2A2A35] bg-bg-surface overflow-hidden', className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-status-thinking hover:bg-bg-elevated transition-colors"
      >
        <ChevronRightIcon className={cn('size-3 transition-transform', expanded && 'rotate-90')} />
        <SparklesIcon className="size-3" />
        <span className="font-medium">Reasoning</span>
      </button>
      {expanded && (
        <div className="border-t border-[#2A2A35] px-3 py-2">
          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      )}
    </div>
  )
}
