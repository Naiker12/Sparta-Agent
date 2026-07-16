import { Loader2 } from 'lucide-react'

export function EditorSkeleton({ path }: { path: string }) {
  const name = path.split(/[\\/]/).pop() ?? path
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 12px', borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)', fontSize: 11,
        fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0,
      }}>
        <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
        <Loader2 size={10} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        <span style={{
          fontSize: 10, color: 'var(--text-muted)',
          fontFamily: 'var(--font-ui)',
        }}>
          Cargando…
        </span>
      </div>
      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} className="shimmer-block" style={{
            height: 13,
            borderRadius: 3,
            width: `${50 + Math.sin(i * 1.7) * 30}%`,
          }} />
        ))}
      </div>
    </div>
  )
}
