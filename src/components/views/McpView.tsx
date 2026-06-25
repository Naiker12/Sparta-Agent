import { useState } from 'react'
import { Plug, Wifi, Globe, Plus } from 'lucide-react'
import { BrandIcon } from '@/components/ui/BrandIcon'
import { useMCPStore } from '@/stores/mcp.store'
import { McpServerCard } from '@/components/mcp/McpServerCard'
import { AddMcpServerDialog } from '@/components/mcp/AddMcpServerDialog'
import type { MCPServer, MCPServerConfig } from '@/types'

type Tab = 'connected' | 'marketplace'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'connected', label: 'Conectados', icon: <Wifi size={12} strokeWidth={1.5} /> },
  { key: 'marketplace', label: 'Marketplace', icon: <Globe size={12} strokeWidth={1.5} /> },
]

interface MarketplaceItem {
  name: string
  desc: string
  icon: string
  vendor?: string
  type: 'stdio' | 'http'
  cmd: string
}

const PLACEHOLDER_MARKETPLACE: MarketplaceItem[] = [
  { name: 'Filesystem', desc: 'Acceso completo al sistema de archivos', icon: '\uD83D\uDCC1', type: 'stdio', cmd: 'npx -y @modelcontextprotocol/server-filesystem' },
  { name: 'Git', desc: 'Operaciones de control de versiones', vendor: 'git', icon: '', type: 'stdio', cmd: 'npx -y @modelcontextprotocol/server-git' },
  { name: 'SQLite', desc: 'Consulta y manipulación de bases de datos', vendor: 'sqlite', icon: '', type: 'stdio', cmd: 'npx -y @modelcontextprotocol/server-sqlite' },
  { name: 'PostgreSQL', desc: 'Gestión de bases de datos PostgreSQL', vendor: 'postgresql', icon: '', type: 'stdio', cmd: 'npx -y @modelcontextprotocol/server-postgres' },
  { name: 'Puppeteer', desc: 'Automatización de navegador web', icon: '\uD83E\uDD16', type: 'stdio', cmd: 'npx -y @modelcontextprotocol/server-puppeteer' },
  { name: 'Brave Search', desc: 'Búsqueda web a través de Brave', icon: '\uD83D\uDD0D', type: 'stdio', cmd: 'npx -y @modelcontextprotocol/server-brave-search' },
]

function marketItemToConfig(item: MarketplaceItem): MCPServerConfig {
  const id = item.name.toLowerCase().replace(/\s+/g, '-')
  const parts = item.cmd.split(' ')
  return {
    id,
    name: item.name,
    type: item.type,
    command: parts[0],
    args: parts.slice(1),
    enabled: true,
  }
}

export function McpView() {
  const { servers } = useMCPStore()
  const [tab, setTab] = useState<Tab>('connected')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editServer, setEditServer] = useState<MCPServer | MCPServerConfig | null>(null)

  const connectedCount = servers.filter((s) => s.connected).length
  const totalCount = servers.length

  function handleEdit(server: MCPServer) {
    setEditServer(server)
    setDialogOpen(true)
  }

  function handleMarketplaceInstall(item: MarketplaceItem) {
    const config = marketItemToConfig(item)
    setEditServer(config)
    setDialogOpen(true)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>
            MCP Servers
          </h2>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--bg-active)', padding: '1px 6px', borderRadius: 3 }}>
            {connectedCount}/{totalCount}
          </span>
        </div>
        <button
          onClick={() => { setEditServer(null); setDialogOpen(true) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', background: 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius-md)', color: 'white', fontSize: 11,
            fontFamily: 'var(--font-ui)', cursor: 'pointer',
          }}
        >
          <Plus size={12} strokeWidth={1.5} />
          Agregar servidor
        </button>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)', padding: '0 16px', flexShrink: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '8px 16px', background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.12s',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 16 }}>
        {tab === 'connected' && (
          <div>
            {servers.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: 60, gap: 12,
              }}>
                <Plug size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} strokeWidth={1} />
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', textAlign: 'center' }}>
                  No hay servidores MCP conectados.
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textAlign: 'center', maxWidth: 320 }}>
                  Los servidores MCP exponen herramientas y recursos que los agentes pueden utilizar para interactuar con el sistema.
                </div>
                <button
                  onClick={() => { setEditServer(null); setDialogOpen(true) }}
                  style={{
                    marginTop: 8, padding: '7px 18px', background: 'var(--accent)', border: 'none',
                    borderRadius: 'var(--radius-md)', color: 'white', fontSize: 11.5,
                    fontFamily: 'var(--font-ui)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Plus size={13} strokeWidth={1.5} />
                  Agregar primer servidor
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {servers.map((server) => (
                  <McpServerCard key={server.id} server={server} onEdit={handleEdit} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'marketplace' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontWeight: 500, marginBottom: 4 }}>
                Servidores populares
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                Instala servidores MCP preconfigurados con un solo clic.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {PLACEHOLDER_MARKETPLACE.map((item) => {
                const installed = servers.some((s) => s.name === item.name)
                return (
                  <div
                    key={item.name}
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: 14,
                      transition: 'all 0.12s',
                      borderLeft: installed ? '3px solid var(--accent)' : '3px solid transparent',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-elevated)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-input)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      {item.vendor ? (
                        <BrandIcon vendor={item.vendor} size={22} />
                      ) : (
                        <span style={{ fontSize: 20 }}>{item.icon}</span>
                      )}
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
                          {item.name}
                        </div>
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-active)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {item.type}
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', margin: '4px 0 10px', lineHeight: 1.4 }}>
                      {item.desc}
                    </p>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 8, padding: '4px 6px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.cmd}
                    </div>
                    {installed ? (
                      <span style={{ fontSize: 10.5, color: 'var(--status-ok)', fontFamily: 'var(--font-ui)' }}>
                        Instalado
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarketplaceInstall(item)}
                        style={{
                          padding: '4px 12px', background: 'var(--accent)', border: 'none',
                          borderRadius: 'var(--radius-sm)', color: 'white', fontSize: 10.5,
                          fontFamily: 'var(--font-ui)', cursor: 'pointer',
                        }}
                      >
                        Instalar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <AddMcpServerDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditServer(null) }}
        editServer={editServer && 'config' in editServer ? editServer.config as MCPServerConfig : (editServer as MCPServerConfig | null)}
      />
    </div>
  )
}
