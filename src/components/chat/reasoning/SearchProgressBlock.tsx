import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, Search, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SearchProgressItem } from '@/types'
import { useTranslation } from '@/i18n'

interface SearchProgressBlockProps {
  items: SearchProgressItem[]
  isActive: boolean
  query?: string
  className?: string
}

export function SearchProgressBlock({ items, isActive, query, className }: SearchProgressBlockProps) {
  const { t } = useTranslation()

  if (items.length === 0 && !isActive) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] overflow-hidden shadow-sm backdrop-blur-md',
        className
      )}
      style={{ margin: '8px 0' }}
    >
      <div className="flex items-center justify-between px-3 py-2 text-xs border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/40">
        <div className="flex items-center gap-2 text-[var(--accent)] font-medium">
          {isActive ? (
            <Loader2 className="size-3.5 animate-spin text-[var(--accent)]" />
          ) : (
            <Search className="size-3.5 text-[var(--accent)]" />
          )}
          <span className="font-medium tracking-tight">
            {isActive 
              ? (query ? t('chat.searchingWebQuery').replace('{{query}}', query) : t('chat.searchingWeb')) 
              : (query ? t('chat.searchResultsQuery').replace('{{query}}', query) : t('chat.searchCompleted'))
            }
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] font-mono bg-[var(--bg-active)] px-1.5 py-0.5 rounded-md">
          <span>{items.filter((i) => i.status === 'visited').length}/{items.length} {t('chat.sites')}</span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {items.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="px-3 py-2 bg-[var(--bg-base)]/30"
          >
            <div className="flex flex-col gap-1.5">
              {items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.2 }}
                  className="flex items-center gap-2.5 text-[11.5px] py-0.5"
                >
                  <div className="flex items-center justify-center shrink-0">
                    {item.status === 'visited' ? (
                      <div className="size-3.5 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Check className="size-2.5 text-green-500 font-bold" />
                      </div>
                    ) : (
                      <div className="size-3.5 rounded-full bg-[var(--accent-muted)] flex items-center justify-center">
                        <Loader2 className="size-2.5 animate-spin text-[var(--accent)]" />
                      </div>
                    )}
                  </div>
                  <Globe className="size-3 shrink-0 text-[var(--text-muted)]" style={{ opacity: 0.7 }} />
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-[var(--text-secondary)] hover:text-[var(--accent)] hover:underline transition-colors duration-150 flex-1 font-medium"
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
