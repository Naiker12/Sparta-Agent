import { motion } from 'framer-motion'
import { BookOpen, Check, Globe, ExternalLink } from 'lucide-react'
import { openExternal } from 'ia-sparta-core'
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
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: 6, margin: '2px 0 4px 0' }}>
      {/* Connector line estilo Claude Code */}
      <div style={{
        position: 'absolute',
        top: 10,
        bottom: 10,
        left: 12,
        width: 1,
        background: 'var(--border-subtle)',
        opacity: 0.6,
      }} />

      {items.map((item, idx) => {
        const domain = extractDomain(item.url)
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -3 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: rowDelay(idx), duration: 0.15 }}
            style={{ position: 'relative', zIndex: 1 }}
          >
            <button
              onClick={() => openExternal(item.url)}
              title={item.title || item.url}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 8px',
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {/* Badge de estado */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 14 }}>
                {item.status === 'visited' ? (
                  <Check size={12} style={{ color: 'var(--status-ok)' }} strokeWidth={2.5} />
                ) : item.status === 'reading' ? (
                  <BookOpen size={12} style={{ color: 'var(--accent)' }} strokeWidth={2} />
                ) : (
                  <Globe size={12} style={{ color: 'var(--text-muted)' }} strokeWidth={1.8} />
                )}
              </div>

              {/* Título limpio */}
              <span style={{
                flex: 1,
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
                fontWeight: 450,
                color: item.status === 'visited' ? 'var(--text-secondary)' : 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {item.title || domain}
              </span>

              {/* Dominio ligero */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 'auto' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {domain}
                </span>
                <ExternalLink size={10} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
              </div>
            </button>
          </motion.div>
        )
      })}
    </div>
  )
}