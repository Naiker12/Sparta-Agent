import { MessageSquare } from 'lucide-react'
import { useSessionStore } from 'ia-sparta-core'

export function SessionsView() {
  const { sessions, activeSessionId, switchSession, createSession } = useSessionStore()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
          Sesiones
        </h2>
        <button onClick={() => createSession()} style={{
          padding: '5px 12px', background: 'var(--accent)', border: 'none',
          borderRadius: 'var(--radius-md)', color: 'white', fontSize: 11,
          fontFamily: 'var(--font-ui)', cursor: 'pointer',
        }}>
          + Nueva sesión
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 12 }}>
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => switchSession(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', cursor: 'pointer',
              background: s.id === activeSessionId ? 'var(--bg-active)' : 'transparent',
              borderRadius: 'var(--radius-md)', marginBottom: 4,
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { if (s.id !== activeSessionId) e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { if (s.id !== activeSessionId) e.currentTarget.style.background = 'transparent' }}
          >
            <MessageSquare size={14} style={{ color: s.id === activeSessionId ? 'var(--accent)' : 'var(--text-muted)' }} />
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
              {s.title}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {s.messageCount}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
