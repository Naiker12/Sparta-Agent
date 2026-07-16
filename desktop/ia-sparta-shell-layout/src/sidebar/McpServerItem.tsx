import type { MCPServer } from 'ia-sparta-core'

interface McpServerItemProps {
  server: MCPServer
}

export function McpServerItem({ server }: McpServerItemProps) {
  const color = server.connected
    ? 'var(--status-ok, #22c55e)'
    : 'var(--text-muted)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 14px',
        cursor: 'default',
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          boxShadow: server.connected ? `0 0 0 2px ${color}22` : 'none',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {server.name}
        </div>
      </div>
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {server.tools.length}
      </span>
    </div>
  )
}
