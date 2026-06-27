export function EditorPanel() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
        Editor — coming soon
      </p>
    </div>
  )
}

export { TerminalPanel } from '@/components/terminal/TerminalPanel'

export { AgentsPanel } from '@/components/agents/AgentsPanel'
