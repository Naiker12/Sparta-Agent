import { cn } from '@/lib/utils'
import { SparklesIcon } from 'lucide-react'

interface ThinkingPillProps {
  isThinking: boolean
  label?: string
  className?: string
}

export function ThinkingPill({ isThinking, label = 'Thinking', className }: ThinkingPillProps) {
  if (!isThinking) return null

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-sm bg-status-thinking/10 px-2 py-0.5',
      className
    )}>
      <SparklesIcon className="size-3 text-status-thinking" />
      <span className="text-[10px] font-medium text-status-thinking">{label}</span>
      <span className="flex gap-0.5">
        <span className="size-1 bg-status-thinking rounded-full animate-pulse-dot" style={{ animationDelay: '0s' }} />
        <span className="size-1 bg-status-thinking rounded-full animate-pulse-dot" style={{ animationDelay: '0.2s' }} />
        <span className="size-1 bg-status-thinking rounded-full animate-pulse-dot" style={{ animationDelay: '0.4s' }} />
      </span>
    </div>
  )
}
