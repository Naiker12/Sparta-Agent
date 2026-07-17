import { Check, X } from 'lucide-react'
import type { DiffProposal } from 'ia-sparta-core'

interface DiffReviewCardProps {
  activeProposal: DiffProposal
  pendingCount: number
  onRespond: (approved: boolean) => void
}

export function DiffReviewCard({ activeProposal, pendingCount, onRespond }: DiffReviewCardProps) {
  return (
    <div style={{
      padding: '8px 12px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'color-mix(in srgb, var(--status-warn) 6%, var(--bg-surface))',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 500, color: 'var(--text-primary)',
        marginBottom: 4,
      }}>
        Cambio propuesto
        {pendingCount > 1 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6, verticalAlign: 'middle' }}>
            {Array.from({ length: Math.min(pendingCount, 5) }, (_, i) => (
              <span
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: i === 0 ? 'var(--accent)' : 'var(--border-normal)',
                  transition: 'background 0.15s',
                }}
              />
            ))}
            {pendingCount > 5 && (
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                +{pendingCount - 5}
              </span>
            )}
          </span>
        )}
      </div>
      <div style={{
        fontSize: 10, color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginBottom: 6,
      }}>
        {activeProposal.filePath.split(/[\\/]/).pop()}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => onRespond(false)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
            padding: '4px 0', borderRadius: 5, cursor: 'pointer',
            fontSize: 11, fontFamily: 'var(--font-ui)',
            background: 'transparent', border: '1px solid var(--border-normal)',
            color: 'var(--status-err)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--status-err)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '' }}
        >
          <X size={11} /> Rechazar
        </button>
        <button
          onClick={() => onRespond(true)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
            padding: '4px 0', borderRadius: 5, cursor: 'pointer',
            fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
            background: 'var(--accent)', border: '1px solid var(--accent)',
            color: '#fff',
            transition: 'filter 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = '' }}
        >
          <Check size={11} /> Aceptar
        </button>
      </div>
    </div>
  )
}
