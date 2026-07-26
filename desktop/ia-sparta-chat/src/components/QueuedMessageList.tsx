import { motion, AnimatePresence } from 'framer-motion'
import { Clock, X, ChevronRight } from 'lucide-react'
import { cn } from 'ia-sparta-core'

interface QueuedItem {
  id: string
  text: string
  timestamp: number
}

interface QueuedMessageListProps {
  queuedItems?: QueuedItem[]
  onRemove?: (id: string) => void
  className?: string
}

export function QueuedMessageList({
  queuedItems = [],
  onRemove,
  className,
}: QueuedMessageListProps) {
  if (!queuedItems || queuedItems.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-1.5 my-2 px-1', className)}>
      <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider">
        <Clock className="size-3 text-accent" />
        <span>Instrucciones en cola ({queuedItems.length})</span>
      </div>

      <AnimatePresence>
        {queuedItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-border/40 bg-card/60 text-xs backdrop-blur-xs shadow-2xs group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center justify-center size-4 rounded bg-accent/10 text-accent font-mono text-[9.5px] font-bold shrink-0">
                #{index + 1}
              </span>
              <ChevronRight className="size-3 text-muted-foreground shrink-0" />
              <span className="text-foreground/90 font-mono text-[11px] truncate max-w-[400px]">
                {item.text}
              </span>
            </div>

            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-all"
                title="Remover de la cola"
              >
                <X className="size-3" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
