export function EditorPanel() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
        Editor — coming soon
      </p>
    </div>
  )
}

export function TerminalPanel() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
        Terminal — coming soon
      </p>
    </div>
  )
}

export { AgentsPanel } from '@/components/agents/AgentsPanel'
