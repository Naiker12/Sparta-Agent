import { useMCPStore } from '@/stores/mcp.store'
import { SidebarSection } from './SidebarSection'
import { McpServerItem } from './McpServerItem'

export function McpSection() {
  const { servers } = useMCPStore()
  const connected = servers.filter((s) => s.connected).length

  return (
    <SidebarSection title="MCP" count={`${connected} conectados`}>
      {servers.length === 0 ? (
        <p
          style={{
            padding: '4px 14px 8px',
            fontSize: 11,
            color: 'var(--text-muted)',
            fontStyle: 'italic',
          }}
        >
          Sin servidores MCP.
        </p>
      ) : (
        servers.map((server) => <McpServerItem key={server.id} server={server} />)
      )}
    </SidebarSection>
  )
}
