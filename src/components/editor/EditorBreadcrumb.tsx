import { ChevronRight } from 'lucide-react'

export function Breadcrumb({ path, agentEditingPaths }: { path: string; agentEditingPaths?: Set<string> }) {
  const parts = path.replace(/\\/g, '/').split('/')
  const isAgentEditing = agentEditingPaths?.has(path) ?? false
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '3px 12px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-muted)',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {parts.map((part, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
          {i > 0 && <ChevronRight size={10} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />}
          <span style={{ color: i === parts.length - 1 ? 'var(--text-primary)' : undefined }}>
            {part}
          </span>
        </span>
      ))}
      {isAgentEditing && (
        <span style={{
          marginLeft: 8,
          padding: '1px 6px',
          borderRadius: 4,
          background: 'rgba(234, 179, 8, 0.12)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          color: 'var(--status-warn)',
          fontSize: 10,
          fontFamily: 'var(--font-ui)',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          Agente editando…
        </span>
      )}
    </div>
  )
}
