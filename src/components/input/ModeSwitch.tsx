import { useSessionStore } from '@/stores/session.store'
import { useSecurityStore } from '@/stores/security.store'
import { useSettingsStore } from '@/stores/settings.store'
import { MessageSquare, Bot, ShieldOff } from 'lucide-react'

export function ModeSwitch() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const sessions = useSessionStore((s) => s.sessions)
  const updateSessionMeta = useSessionStore((s) => s.updateSessionMeta)
  const defaultSessionMode = useSettingsStore((s) => s.sessionMode)
  const setDefaultSessionMode = useSettingsStore((s) => s.setSessionMode)
  const securityLoaded = useSecurityStore((s) => s.loaded)
  const securityChecked = useSecurityStore((s) => s.checked)

  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : null
  const sessionMode = activeSession?.sessionMode ?? defaultSessionMode

  const setSessionMode = (mode: 'chat' | 'agent') => {
    if (activeSessionId) {
      updateSessionMeta(activeSessionId, { sessionMode: mode })
    } else {
      setDefaultSessionMode(mode)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <div
        style={{
          display: 'flex',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          background: 'var(--bg-hover)',
          padding: '2px',
        }}
      >
        <button
          onClick={() => setSessionMode('chat')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 'calc(var(--radius-md) - 2px)',
            background: sessionMode === 'chat' ? 'var(--bg-surface)' : 'transparent',
            border: 'none',
            boxShadow: sessionMode === 'chat' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            color: sessionMode === 'chat' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
            fontWeight: sessionMode === 'chat' ? 500 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <MessageSquare size={13} strokeWidth={sessionMode === 'chat' ? 2 : 1.5} style={{ opacity: sessionMode === 'chat' ? 1 : 0.7 }} />
          <span>Chat</span>
        </button>
        <button
          onClick={() => setSessionMode('agent')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 'calc(var(--radius-md) - 2px)',
            background: sessionMode === 'agent' ? 'var(--bg-surface)' : 'transparent',
            border: 'none',
            boxShadow: sessionMode === 'agent' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            color: sessionMode === 'agent' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
            fontWeight: sessionMode === 'agent' ? 500 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Bot size={13} strokeWidth={sessionMode === 'agent' ? 2 : 1.5} style={{ opacity: sessionMode === 'agent' ? 1 : 0.7 }} />
          <span>Agente</span>
        </button>
      </div>
      {securityChecked && !securityLoaded && (
        <span
          title="Módulo de seguridad no disponible — el agente está en modo degradado (solo-lectura)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: '3px 6px',
            borderRadius: 4,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#f87171',
            fontSize: 10,
            fontFamily: 'var(--font-ui)',
            fontWeight: 500,
            cursor: 'default',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldOff size={11} />
          <span>Seguridad</span>
        </span>
      )}
    </div>
  )
}
