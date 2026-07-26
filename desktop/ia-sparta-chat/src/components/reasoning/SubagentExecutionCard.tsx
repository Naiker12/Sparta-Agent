import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from 'ia-sparta-core'
import {
  Bot,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
  Terminal,
  Search,
  Code,
  Globe,
  Clock,
  Sparkles,
} from 'lucide-react'

interface SubagentExecutionCardProps {
  subagentName: string
  taskSummary?: string
  status: 'running' | 'completed' | 'failed'
  durationMs?: number
  success?: boolean
  className?: string
}

function getSubagentIcon(name: string) {
  const lower = name.toLowerCase()
  if (lower.includes('search') || lower.includes('research')) return Search
  if (lower.includes('code') || lower.includes('editor')) return Code
  if (lower.includes('browser') || lower.includes('web')) return Globe
  if (lower.includes('term') || lower.includes('cli')) return Terminal
  return Bot
}

export function SubagentExecutionCard({
  subagentName,
  taskSummary,
  status,
  durationMs,
  success = true,
  className,
}: SubagentExecutionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const Icon = getSubagentIcon(subagentName)

  const formattedDuration = durationMs
    ? durationMs < 1000
      ? `${durationMs}ms`
      : `${(durationMs / 1000).toFixed(1)}s`
    : null

  const isRunning = status === 'running'
  const isSuccess = status === 'completed' && success
  const isFailed = status === 'failed' || (status === 'completed' && !success)

  return (
    <div className={cn('my-1.5 rounded-lg border border-border/40 bg-card/40 text-xs shadow-2xs overflow-hidden transition-all hover:border-border/70', className)}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-accent/10 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              'flex items-center justify-center size-6 rounded-md border shrink-0',
              isRunning && 'bg-amber-500/10 border-amber-500/30 text-amber-400',
              isSuccess && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
              isFailed && 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            )}
          >
            <Icon className="size-3.5" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground font-mono text-[11px] truncate">
                {subagentName}
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.25 rounded text-[9.5px] font-medium bg-muted/60 text-muted-foreground border border-border/30">
                <Sparkles className="size-2.5 text-accent" />
                Subagente
              </span>
            </div>

            {taskSummary && (
              <span className="text-[10.5px] text-muted-foreground truncate max-w-[280px]">
                {taskSummary}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {formattedDuration && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/80">
              <Clock className="size-3" />
              {formattedDuration}
            </span>
          )}

          {isRunning && (
            <span className="flex items-center gap-1 text-[10.5px] font-medium text-amber-400">
              <Loader2 className="size-3 animate-spin" />
              En ejecución
            </span>
          )}

          {isSuccess && (
            <span className="flex items-center gap-1 text-[10.5px] font-medium text-emerald-400">
              <CheckCircle className="size-3" />
              Completado
            </span>
          )}

          {isFailed && (
            <span className="flex items-center gap-1 text-[10.5px] font-medium text-rose-400">
              <XCircle className="size-3" />
              Fallido
            </span>
          )}

          <ChevronRight
            className={cn(
              'size-3.5 text-muted-foreground transition-transform duration-200 ml-1',
              expanded && 'rotate-90'
            )}
          />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border/30 bg-muted/20 px-3 py-2 text-[11px]"
          >
            <div className="ml-2 pl-3 border-l border-border/40 space-y-1.5">
              <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px]">
                <span>Tipo de agente: {subagentName}</span>
                <span>Estado: {status}</span>
              </div>
              {taskSummary && (
                <div className="text-foreground/90 bg-background/50 p-2 rounded border border-border/20 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap">
                  {taskSummary}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
