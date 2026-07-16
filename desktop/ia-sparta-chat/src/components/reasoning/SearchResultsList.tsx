import { motion } from 'framer-motion'
import { BookOpen, Check, Globe } from 'lucide-react'
import { cn } from 'ia-sparta-core'
import type { SearchProgressItem } from 'ia-sparta-core'

interface SearchResultsListProps {
  items: SearchProgressItem[]
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function rowDelay(idx: number): number {
  return Math.min(idx * 0.05, 0.35)
}

export function SearchResultsList({ items }: SearchResultsListProps) {
  if (items.length === 0) return null

  return (
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
  )
}