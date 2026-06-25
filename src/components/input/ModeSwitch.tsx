import { useSettingsStore } from '@/stores/settings.store'

export function ModeSwitch() {
  const { sessionMode, setSessionMode } = useSettingsStore()

  return (
    <div
      style={{
        display: 'flex',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-active)',
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
          padding: '5px 10px',
          background: sessionMode === 'chat' ? 'var(--bg-surface)' : 'none',
          border: 'none',
          color: sessionMode === 'chat' ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: 12,
          fontFamily: 'var(--font-ui)',
          fontWeight: sessionMode === 'chat' ? 500 : 400,
          cursor: 'pointer',
          transition: 'all 0.12s',
        }}
      >
        💬 Chat
      </button>
      <button
        onClick={() => setSessionMode('agent')}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '5px 10px',
          background: sessionMode === 'agent' ? 'var(--bg-surface)' : 'none',
          border: 'none',
          color: sessionMode === 'agent' ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: 12,
          fontFamily: 'var(--font-ui)',
          fontWeight: sessionMode === 'agent' ? 500 : 400,
          cursor: 'pointer',
          transition: 'all 0.12s',
        }}
      >
        🤖 Agente
      </button>
    </div>
  )
}
