import { useState } from 'react'
import { Clock, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { useHarnessHistoryStore } from 'ia-sparta-core'

export function HarnessHistoryList() {
  const [isOpen, setIsOpen] = useState(false)
  const entries = useHarnessHistoryStore((s) => s.entries)
  const clearHistory = useHarnessHistoryStore((s) => s.clearHistory)

  if (entries.length === 0) return null

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 12,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => setIsOpen((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {isOpen ? <ChevronDown size={14} color="var(--accent)" /> : <ChevronRight size={14} />}
          <Clock size={14} color="var(--accent)" />
          <span>Bitácora de Detección ({entries.length})</span>
        </button>

        {isOpen && entries.length > 0 && (
          <button
            onClick={clearHistory}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 11,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <Trash2 size={12} />
            <span>Limpiar</span>
          </button>
        )}
      </div>

      {isOpen && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: 8,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{entry.harnessId}</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: 'var(--text-secondary)' }}>{entry.action}</span>
                {entry.detail && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.detail}
                    </span>
                  </>
                )}
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0, marginLeft: 8 }}>
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
