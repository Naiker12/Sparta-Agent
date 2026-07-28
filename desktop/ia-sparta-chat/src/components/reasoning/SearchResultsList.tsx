import { motion } from 'framer-motion'
import { BookOpen, Check, Globe, ExternalLink } from 'lucide-react'
import { cn } from 'ia-sparta-core'
import type { SearchProgressItem } from 'ia-sparta-core'

interface SearchResultsListProps {
  items: SearchProgressItem[]
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function rowDelay(idx: number): number {
  return Math.min(idx * 0.04, 0.3)
}

export function SearchResultsList({ items }: SearchResultsListProps) {
  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-1 pt-1">
      {items.map((item, idx) => {
        const domain = extractDomain(item.url)
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rowDelay(idx), duration: 0.18, ease: 'easeOut' }}
          >
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors duration-150 bg-[var(--bg-input)]/40 hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)]/50 group"
              title={item.title || item.url}
              onClick={(e) => {
                e.preventDefault()
                if (window.electron?.send)
                  window.electron.send('shell:open-external', item.url)
                else
                  window.open(item.url, '_blank', 'noopener')
              }}
              style={{ textDecoration: 'none' }}
            >
              {/* Status icon badge */}
              <div className="flex items-center justify-center shrink-0">
                {item.status === 'visited' ? (
                  <div className="size-3.5 rounded-full bg-[var(--status-ok)]/15 flex items-center justify-center group-hover:bg-[var(--status-ok)]/25 transition-colors duration-200">
                    <Check className="size-2 text-[var(--status-ok)]" strokeWidth={3} />
                  </div>
                ) : item.status === 'reading' ? (
                  <div className="size-3.5 rounded-full bg-[var(--accent)]/15 flex items-center justify-center group-hover:bg-[var(--accent)]/25 transition-colors duration-200">
                    <BookOpen className="size-2 text-[var(--accent)]" strokeWidth={3} />
                  </div>
                ) : (
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                    className="size-3.5 rounded-full border border-[var(--accent)]/30 flex items-center justify-center"
                  >
                    <div className="size-1 rounded-full bg-[var(--accent)]" />
                  </motion.div>
                )}
              </div>

              {/* Globe Icon */}
              <Globe
                className={cn(
                  'size-3 shrink-0 transition-colors duration-200',
                  item.status === 'visited'
                    ? 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                    : item.status === 'reading'
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--accent)]/60'
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
                {item.title || domain}
              </span>

              {/* Domain & External link indicator (right-aligned) */}
              <div className="flex items-center gap-1 shrink-0 ml-auto pl-2">
                <span className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] font-mono transition-colors duration-200">
                  {domain}
                </span>
                <ExternalLink className="size-2.5 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors duration-200" />
              </div>
            </a>
          </motion.div>
        )
      })}
    </div>
  )
}