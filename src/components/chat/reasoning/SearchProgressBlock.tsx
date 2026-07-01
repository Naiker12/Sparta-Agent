import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, Search, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SearchProgressItem } from '@/types'

interface SearchProgressBlockProps {
  items: SearchProgressItem[]
  isActive: boolean
  className?: string
}

export function SearchProgressBlock({ items, isActive, className }: SearchProgressBlockProps) {
  if (items.length === 0 && !isActive) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-sm border border-border-subtle bg-bg-surface overflow-hidden',
        className
      )}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-status-thinking">
        {isActive ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Search className="size-3" />
        )}
        <span className="font-medium">
          {isActive ? 'Buscando en la web...' : 'Búsqueda completada'}
        </span>
        <span className="text-[10px] text-status-thinking/60 ml-1 font-mono">
          {items.filter((i) => i.status === 'visited').length}/{items.length}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {items.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-3 pb-2 pt-0"
          >
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-[11px]"
                >
                  {item.status === 'visited' ? (
                    <Check className="size-3 shrink-0 text-green-500" />
                  ) : (
                    <Loader2 className="size-3 shrink-0 animate-spin text-status-thinking" />
                  )}
                  <Globe className="size-3 shrink-0 text-text-muted" />
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-text-secondary hover:text-text-primary hover:underline"
                    title={item.title}
                    onClick={(e) => {
                      e.preventDefault()
                      if (window.electron?.send) {
                        window.electron.send('shell:open-external', item.url)
                      } else {
                        window.open(item.url, '_blank', 'noopener')
                      }
                    }}
                  >
                    {item.title}
                  </a>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
