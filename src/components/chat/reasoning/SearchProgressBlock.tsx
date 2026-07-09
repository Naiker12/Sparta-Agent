import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Check, ChevronDown, Globe, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SearchProgressItem } from '@/types'
import { useTranslation } from '@/i18n'

interface SearchProgressBlockProps {
  items: SearchProgressItem[]
  isActive: boolean
  query?: string
  className?: string
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function rowDelay(idx: number): number {
  return Math.min(idx * 0.05, 0.35)
}

const chevronTransition = { duration: 0.2, ease: 'easeInOut' as const }
const urlListTransition = { duration: 0.2, ease: 'easeInOut' as const }

export function SearchProgressBlock({ items, isActive, query, className }: SearchProgressBlockProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)
  const prevActiveRef = useRef(isActive)

  useEffect(() => {
    if (isActive) {
      setIsExpanded(true)
    } else if (prevActiveRef.current && !isActive && items.length > 0) {
      const timer = setTimeout(() => setIsExpanded(false), 800)
      return () => clearTimeout(timer)
    }
    prevActiveRef.current = isActive
  }, [isActive, items.length])

  if (items.length === 0 && !isActive) return null

  const visitedCount = items.filter((i) => i.status === 'visited').length
  const readingCount = items.filter((i) => i.status === 'reading').length
  const isDone = !isActive && visitedCount > 0
  const allVisited = items.length > 0 && items.every((i) => i.status === 'visited')

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'rounded-xl overflow-hidden shadow-sm transition-shadow duration-300 relative',
        isActive
          ? 'border border-[var(--accent)]/15 shadow-[var(--accent)]/5'
          : 'border border-[var(--border-normal)] shadow-black/5',
        className
      )}
      style={{ margin: '8px 0' }}
    >
      {/* Accent left bar — active only */}
      {isActive && (
        <div
          className="absolute left-0 inset-y-0 w-[2px] rounded-l-xl"
          style={{ background: 'var(--accent)', opacity: 0.4 }}
        />
      )}

      {/* Header */}
      <button
        onClick={() => items.length > 0 && setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center justify-between w-full relative',
          'transition-colors duration-200',
          items.length > 0 && 'cursor-pointer',
          isActive
            ? 'hover:bg-[var(--accent)]/[0.02]'
            : allVisited
              ? 'hover:bg-[var(--status-ok)]/[0.02]'
              : 'hover:bg-[var(--bg-hover)]/30'
        )}
        style={{
          border: 'none',
          background: 'transparent',
          fontFamily: 'inherit',
          padding: '10px 12px',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Status icon */}
          <div
            className={cn(
              'flex items-center justify-center shrink-0 transition-colors duration-300',
              isActive
                ? 'text-[var(--accent)]'
                : allVisited
                  ? 'text-[var(--status-ok)]'
                  : 'text-[var(--text-muted)]'
            )}
            style={{ width: 18, height: 18 }}
          >
            {isActive ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              >
                <Loader2 className="size-3" strokeWidth={2.5} />
              </motion.div>
            ) : (
              <Check className="size-3" strokeWidth={2.5} />
            )}
          </div>

          {/* Label + query */}
          <div className="flex flex-col items-start min-w-0 gap-px">
            <span
              className={cn(
                'text-[13px] font-medium leading-tight truncate max-w-full transition-colors duration-300',
                isActive
                  ? 'text-[var(--text-primary)]'
                  : allVisited
                    ? 'text-[var(--status-ok)]'
                    : 'text-[var(--text-secondary)]'
              )}
            >
            {isActive
              ? readingCount > 0
                ? t('chat.readingSources')
                : (query ?? t('chat.searchingWeb'))
              : allVisited
                ? t('chat.searchedSites').replace('{n}', String(visitedCount))
                : t('chat.searchCompleted')
            }
            </span>
            {isActive && query && (
              <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[260px] leading-tight">
                {query}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* Count badge */}
          <span
            className={cn(
              'text-[11px] font-mono px-1.5 py-0.5 rounded-md font-medium select-none transition-colors duration-300',
              isActive
                ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                : allVisited
                  ? 'bg-[var(--status-ok)]/10 text-[var(--status-ok)]'
                  : 'bg-[var(--bg-active)] text-[var(--text-muted)]'
            )}
          >
            {isDone || allVisited ? visitedCount : `${visitedCount}/${items.length}`}
          </span>

          {/* Chevron */}
          {items.length > 0 && (
            <motion.div
              animate={{ rotate: isExpanded ? 0 : -90 }}
              transition={chevronTransition}
              className={cn(
                'flex items-center justify-center transition-colors duration-200',
                isExpanded ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
              )}
            >
              <ChevronDown className="size-3.5" strokeWidth={1.5} />
            </motion.div>
          )}
        </div>
      </button>

      {/* URL list */}
      <AnimatePresence initial={false}>
        {isExpanded && items.length > 0 && (
          <motion.div
            key="url-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={urlListTransition}
            className="overflow-hidden"
          >
            <div style={{ padding: '0 12px 8px 12px', borderTop: '1px solid var(--border-subtle)' }}>
              <div className="flex flex-col gap-px pt-1.5">
                {items.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: rowDelay(idx), duration: 0.2, ease: 'easeOut' }}
                  >
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 py-1 px-1.5 -mx-1.5 rounded-md transition-colors duration-150 hover:bg-[var(--bg-hover)]/50 group"
                      title={item.title}
                      onClick={(e) => {
                        e.preventDefault()
                        if (window.electron?.send)
                          window.electron.send('shell:open-external', item.url)
                        else
                          window.open(item.url, '_blank', 'noopener')
                      }}
                      style={{ textDecoration: 'none' }}
                    >
                      {/* Status dot */}
                      <div className="flex items-center justify-center shrink-0">
                        {item.status === 'visited' ? (
                          <div className="size-[10px] rounded-full bg-[var(--status-ok)]/12 flex items-center justify-center group-hover:bg-[var(--status-ok)]/20 transition-colors duration-200">
                            <Check className="size-[6px] text-[var(--status-ok)]" strokeWidth={3} />
                          </div>
                        ) : item.status === 'reading' ? (
                          <div className="size-[10px] rounded-full bg-[var(--accent)]/12 flex items-center justify-center group-hover:bg-[var(--accent)]/20 transition-colors duration-200">
                            <BookOpen className="size-[6px] text-[var(--accent)]" strokeWidth={3} />
                          </div>
                        ) : (
                          <motion.div
                            animate={{ opacity: [0.3, 0.8, 0.3] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                            className="size-[10px] rounded-full border border-[var(--accent)]/25 flex items-center justify-center"
                          >
                            <div className="size-[4px] rounded-full bg-[var(--accent)]/30" />
                          </motion.div>
                        )}
                      </div>

                      {/* Globe */}
                      <Globe
                        className={cn(
                          'size-[10px] shrink-0 transition-colors duration-200',
                          item.status === 'visited'
                            ? 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                            : item.status === 'reading'
                              ? 'text-[var(--accent)]/60'
                              : 'text-[var(--accent)]/40'
                        )}
                        strokeWidth={1.5}
                      />

                      {/* Title */}
                      <span
                        className={cn(
                          'truncate text-[12px] leading-tight font-medium transition-colors duration-200 flex-1',
                          item.status === 'visited'
                            ? 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                            : item.status === 'reading'
                              ? 'text-[var(--text-primary)]'
                              : 'text-[var(--text-muted)]'
                        )}
                      >
                        {item.title}
                      </span>

                      {/* Domain (visible on hover) */}
                      {(item.status === 'visited' || item.status === 'reading') && (
                        <span className="hidden sm:inline text-[10px] text-[var(--text-muted)] truncate max-w-[100px] shrink-0 ml-1 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {extractDomain(item.url)}
                        </span>
                      )}
                    </a>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
