import { useState } from 'react'
import { Plug, Wifi, Globe, Plus, Check, Server, Zap, ExternalLink } from 'lucide-react'
import { BrandIcon } from 'ia-sparta-design-system'
import { useMCPStore } from 'ia-sparta-core'
import { McpServerCard } from './McpServerCard'
import { AddMcpServerDialog } from './AddMcpServerDialog'
import { Button } from 'ia-sparta-design-system'
import type { MCPServer, MCPServerConfig } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import { catalogToMarketplaceItems } from './data/mcp-catalog'

type Tab = 'connected' | 'marketplace'

interface MarketplaceItem {
  id: string
  name: string
  description: string
  type: 'stdio' | 'http'
  cmd: string
  category: string
  env_required: string[]
  headers_required: string[]
  notes?: string
  docs_url?: string
  vendor?: string
}

const CATALOG_ITEMS = catalogToMarketplaceItems()

function marketItemToConfig(item: MarketplaceItem): MCPServerConfig {
  const parts = item.cmd.split(' ')
  return { id: item.id, name: item.name, type: item.type, command: parts[0], args: parts.slice(1), enabled: true }
}

/* ── Category accent colors (CSS-var safe) ─────────────────── */
const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  Storage:      { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
  DevTools:     { bg: 'rgba(249,115,22,0.12)',  color: '#fb923c' },
  Database:     { bg: 'rgba(168,85,247,0.12)',  color: '#c084fc' },
  Web:          { bg: 'rgba(34,197,94,0.12)',   color: '#4ade80' },
  Productivity: { bg: 'rgba(236,72,153,0.12)',  color: '#f472b6' },
  Other:        { bg: 'var(--bg-active)',        color: 'var(--text-muted)' },
}

function StatPill({ label, value, accent = false, icon }: { label: string; value: number; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
      {icon}
      <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
      <span style={{ fontWeight: 600, color: accent ? 'var(--status-ok)' : 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  )
}

export function McpView() {
  const { servers } = useMCPStore()
  const { t, lang } = useTranslation()
  const [tab, setTab] = useState<Tab>('connected')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editServer, setEditServer] = useState<MCPServerConfig | null>(null)

  const connectedCount = servers.filter((s) => s.connected).length
  const totalCount = servers.length
  const totalTools = servers.reduce((acc, s) => acc + s.tools.length, 0)

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'connected', label: t('mcp.connected'), icon: <Wifi size={12} strokeWidth={1.8} /> },
    { key: 'marketplace', label: t('mcp.marketplace'), icon: <Globe size={12} strokeWidth={1.8} /> },
  ]

  function handleEdit(server: MCPServer) { setEditServer(server.config); setDialogOpen(true) }
  function handleMarketplaceInstall(item: MarketplaceItem) {
    setEditServer(marketItemToConfig(item)); setDialogOpen(true)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-ui)', background: 'var(--bg-base)' }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', borderBottom: '1px solid var(--border-normal)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            height: 30, width: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
            color: 'var(--accent)',
          }}>
            <Server size={14} strokeWidth={1.8} />
          </div>
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>
              {t('mcp.servers')}
            </h2>
            {totalCount > 0 && (
              <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '3px 0 0', fontFamily: 'var(--font-mono)' }}>
                {connectedCount}/{totalCount} {lang === 'es' ? 'activos' : 'active'} · {totalTools} tools
              </p>
            )}
          </div>
        </div>

        <Button
          onClick={() => { setEditServer(null); setDialogOpen(true) }}
          size="sm"
          style={{ fontSize: 11, fontWeight: 600, height: 30, gap: 6 }}
        >
          <Plus size={12} strokeWidth={2.5} />
          {t('mcp.addServer')}
        </Button>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────── */}
      {totalCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '6px 20px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', flexShrink: 0,
        }}>
          <StatPill label={lang === 'es' ? 'Conectados' : 'Connected'} value={connectedCount} accent />
          <div style={{ width: 1, height: 12, background: 'var(--border-normal)' }} />
          <StatPill label={lang === 'es' ? 'Servidores' : 'Servers'} value={totalCount} />
          <div style={{ width: 1, height: 12, background: 'var(--border-normal)' }} />
          <StatPill label="Tools" value={totalTools} icon={<Zap size={10} style={{ color: 'var(--status-warn)' }} />} />
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', padding: '0 20px',
        borderBottom: '1px solid var(--border-normal)', background: 'var(--bg-surface)', flexShrink: 0,
      }}>
        {TABS.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '8px 12px', fontSize: 11, fontWeight: tab === tabItem.key ? 600 : 500,
              fontFamily: 'var(--font-ui)', cursor: 'pointer', border: 'none', background: 'transparent',
              borderBottom: `2px solid ${tab === tabItem.key ? 'var(--accent)' : 'transparent'}`,
              color: tab === tabItem.key ? 'var(--accent)' : 'var(--text-secondary)',
              transition: 'all 0.15s', marginBottom: -1,
              outline: 'none',
            }}
          >
            {tabItem.icon}
            {tabItem.label}
            {tabItem.key === 'connected' && totalCount > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10,
                fontFamily: 'var(--font-mono)', lineHeight: 1.4,
                background: tab === 'connected' ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--bg-active)',
                color: tab === 'connected' ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                {totalCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content Area ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {tab === 'connected' && (
          <div>
            {servers.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '60px 20px', textAlign: 'center', gap: 12, color: 'var(--text-muted)',
              }}>
                <div style={{
                  height: 48, width: 48, borderRadius: 12, background: 'var(--bg-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--border-normal)', color: 'var(--text-muted)',
                }}>
                  <Plug size={22} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    {t('mcp.noServersTitle')}
                  </h3>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0', maxWidth: 360, lineHeight: 1.5 }}>
                    {t('mcp.noServersDesc')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <Button onClick={() => setTab('marketplace')} size="sm" variant="secondary" style={{ fontSize: 11 }}>
                    <Globe size={11} style={{ marginRight: 4 }} />
                    {t('mcp.browseMarketplace')}
                  </Button>
                  <Button onClick={() => { setEditServer(null); setDialogOpen(true) }} size="sm" style={{ fontSize: 11 }}>
                    <Plus size={11} style={{ marginRight: 4 }} />
                    {t('mcp.addServer')}
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {servers.map((server) => (
                  <McpServerCard key={server.id} server={server} onEdit={handleEdit} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'marketplace' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {CATALOG_ITEMS.map((item) => {
                const installed = servers.some((s) => s.id === item.id)
                const catStyle = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.Other
                const brandVendor = item.vendor
                return (
                  <div
                    key={item.id}
                    style={{
                      borderRadius: 10, border: '1px solid var(--border-normal)',
                      background: 'var(--bg-surface)', padding: '12px 14px',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          {brandVendor
                            ? <BrandIcon vendor={brandVendor} size={15} />
                            : <Plug size={13} style={{ color: 'var(--text-muted)' }} />
                          }
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
                            {item.name}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                          fontFamily: 'var(--font-mono)', background: catStyle.bg, color: catStyle.color,
                        }}>
                          {item.category}
                        </span>
                      </div>

                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45, fontFamily: 'var(--font-ui)' }}>
                        {item.description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Cmd: {item.cmd.split(' ')[0]}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.docs_url && (
                          <a
                            href={item.docs_url} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 3 }}
                            title="Ver documentación"
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}

                        <Button
                          onClick={() => handleMarketplaceInstall(item)}
                          disabled={installed}
                          size="xs"
                          variant={installed ? 'ghost' : 'secondary'}
                          style={{ fontSize: 10, fontWeight: 600, height: 24, gap: 4 }}
                        >
                          {installed ? <Check size={10} style={{ color: 'var(--status-ok)' }} /> : <Plus size={10} />}
                          {installed ? t('mcp.installed') : t('mcp.install')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <AddMcpServerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editServer={editServer}
      />
    </div>
  )
}
