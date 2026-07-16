import { useState } from 'react'
import { Plug, Wifi, Globe, Plus, Check, Server, Zap, ExternalLink } from 'lucide-react'
import { BrandIcon } from '@/components/ui/BrandIcon'
import { useMCPStore } from '@/stores/mcp.store'
import { McpServerCard } from '@/components/mcp/McpServerCard'
import { AddMcpServerDialog } from '@/components/mcp/AddMcpServerDialog'
import { Button } from '@/components/ui/button'
import type { MCPServer, MCPServerConfig } from '@/types'
import { useTranslation } from '@/i18n'
import { catalogToMarketplaceItems } from '@/data/mcp-catalog'

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

export function McpView() {
  const { servers } = useMCPStore()
  const { t, lang } = useTranslation()
  const [tab, setTab] = useState<Tab>('connected')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editServer, setEditServer] = useState<MCPServer | MCPServerConfig | null>(null)

  const connectedCount = servers.filter((s) => s.connected).length
  const totalCount = servers.length
  const totalTools = servers.reduce((acc, s) => acc + s.tools.length, 0)

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'connected', label: t('mcp.connected'), icon: <Wifi size={12} strokeWidth={1.8} /> },
    { key: 'marketplace', label: t('mcp.marketplace'), icon: <Globe size={12} strokeWidth={1.8} /> },
  ]

  function handleEdit(server: MCPServer) { setEditServer(server); setDialogOpen(true) }
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
              borderBottom: `2px solid ${tab === tabItem.key ? 'var(--accent)' : 'transparent'}',`,
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

      {/* ── Content ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* Tab: Connected */}
        {tab === 'connected' && (
          servers.length === 0 ? (
            <EmptyMcpState
              onAdd={() => { setEditServer(null); setDialogOpen(true) }}
              addLabel={t('mcp.addFirstServer')}
              title={t('mcp.noServers')}
              description={t('mcp.noServersDesc')}
            />
          ) : (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {servers.map((server) => (
                <McpServerCard key={server.id} server={server} onEdit={handleEdit} />
              ))}
            </div>
          )
        )}

        {/* Tab: Marketplace */}
        {tab === 'marketplace' && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                {t('mcp.popularServers')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 520 }}>
                {t('mcp.popularServersDesc')}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {CATALOG_ITEMS.map((item) => {
                const installed = servers.some((s) => s.id === item.id || s.name === item.name)
                return (
                  <MarketplaceCard
                    key={item.id}
                    item={item}
                    desc={item.description}
                    installed={installed}
                    onInstall={() => handleMarketplaceInstall(item)}
                    installLabel={t('mcp.install')}
                    installedLabel={t('mcp.installed')}
                    lang={lang}
                  />
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

/* ─── Sub-components ──────────────────────────────────────────────────── */

function StatPill({ label, value, accent = false, icon }: {
  label: string; value: number; accent?: boolean; icon?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {icon}
      <span style={{
        fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
        color: accent ? 'var(--status-ok)' : 'var(--text-primary)',
      }}>
        {value}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
        {label}
      </span>
    </div>
  )
}

function EmptyMcpState({ onAdd, addLabel, title, description }: {
  onAdd: () => void; addLabel: string; title: string; description: string
}) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '60px 40px', textAlign: 'center', gap: 0,
    }}>
      {/* Icon */}
      <div style={{
        width: 64, height: 64, borderRadius: 16, marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '2px dashed var(--border-strong)',
        background: 'var(--bg-surface)',
        color: 'var(--text-muted)', position: 'relative',
      }}>
        <Plug size={26} strokeWidth={1.4} />
        {/* Pulse dot */}
        <span style={{
          position: 'absolute', top: -5, right: -5,
          width: 12, height: 12, borderRadius: '50%',
          background: 'var(--bg-active)', border: '2px solid var(--bg-base)',
        }} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{
        fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
        maxWidth: 300, marginBottom: 20,
      }}>
        {description}
      </div>

      <Button onClick={onAdd} size="sm" style={{ fontSize: 11, fontWeight: 600, gap: 6 }}>
        <Plus size={12} strokeWidth={2.5} />
        {addLabel}
      </Button>

      {/* Quick tips */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        marginTop: 28, width: '100%', maxWidth: 300,
      }}>
        {[
          { icon: '🔌', label: 'Stdio' },
          { icon: '🌐', label: 'HTTP / SSE' },
          { icon: '📦', label: 'Marketplace' },
        ].map((tip) => (
          <div key={tip.label} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            padding: '10px 8px', borderRadius: 10,
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          }}>
            <span style={{ fontSize: 16 }}>{tip.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              {tip.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function _catalogIcon(item: MarketplaceItem): string {
  const name = item.name.toLowerCase()
  if (name.includes('github')) return '\u2764\uFE0F'  // heart for gh
  if (name.includes('filesystem')) return '\uD83D\uDCC1'  // folder
  if (name.includes('notion')) return '\uD83D\uDCDD'  // memo
  if (name.includes('postgres')) return '\uD83D\uDDC4'  // database
  if (name.includes('sqlite')) return '\uD83D\uDCC4'  // scroll
  if (name.includes('puppeteer')) return '\uD83E\uDD16'  // robot
  return '\uD83D\uDD0C'  // plug
}

function MarketplaceCard({ item, desc, installed, onInstall, installLabel, installedLabel, lang }: {
  item: MarketplaceItem; desc: string; installed: boolean; lang?: string
  onInstall: () => void; installLabel: string; installedLabel: string
}) {
  const cat = CATEGORY_STYLE[item.category] ?? { bg: 'var(--bg-active)', color: 'var(--text-muted)' }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', borderRadius: 12,
      border: installed ? '1px solid rgba(34,197,94,0.25)' : '1px solid var(--border-normal)',
      background: installed ? 'color-mix(in srgb, #22c55e 4%, var(--bg-surface))' : 'var(--bg-surface)',
      overflow: 'hidden', position: 'relative', transition: 'border-color 0.15s, box-shadow 0.15s',
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = installed ? 'rgba(34,197,94,0.45)' : 'var(--border-strong)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = installed ? 'rgba(34,197,94,0.25)' : 'var(--border-normal)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
    >
      {/* Installed badge */}
      {installed && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
          color: '#4ade80', background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.25)',
          padding: '2px 6px', borderRadius: 6, fontFamily: 'var(--font-mono)',
        }}>
          <Check size={8} strokeWidth={3} />
          {installedLabel}
        </div>
      )}

      <div style={{ padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {/* Icon + name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-normal)',
          }}>
            {item.vendor
              ? <BrandIcon vendor={item.vendor} size={20} />
              : <span style={{ fontSize: 18 }}>{_catalogIcon(item)}</span>
            }
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {item.name}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                padding: '1px 5px', borderRadius: 4, fontFamily: 'var(--font-mono)',
                background: cat.bg, color: cat.color,
              }}>
                {item.category}
              </span>
            </div>
            <span style={{
              display: 'inline-block', marginTop: 2,
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
              color: 'var(--text-muted)', letterSpacing: '0.05em',
              fontFamily: 'var(--font-mono)',
            }}>
              {item.type}
            </span>
          </div>
        </div>

        {/* Description */}
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          {desc}
        </p>

        {/* Command */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 7,
          background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)',
          overflow: 'hidden',
        }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>$</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {item.cmd}
          </span>
        </div>

        {/* Env requirements */}
        {item.env_required.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--status-warn)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
            {lang === 'es' ? 'Requiere' : 'Requires'}: {item.env_required.join(', ')}
          </div>
        )}
        {item.headers_required.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--status-warn)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
            Headers: {item.headers_required.join(', ')}
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.4, fontStyle: 'italic' }}>
            {item.notes}
          </div>
        )}

        {/* Docs link */}
        {item.docs_url && (
          <a
            href={item.docs_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-ui)',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              textDecoration: 'none', marginTop: -4,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={10} />
            Docs
          </a>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '0 14px 14px' }}>
        {installed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#4ade80', fontWeight: 500 }}>
            <Check size={12} strokeWidth={2.5} />
            {installedLabel}
          </div>
        ) : (
          <button
            onClick={onInstall}
            style={{
              width: '100%', height: 30, borderRadius: 7, border: '1px solid var(--border-normal)',
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              transition: 'background 0.12s, border-color 0.12s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-normal)' }}
          >
            <Plus size={12} strokeWidth={2.5} />
            {installLabel}
          </button>
        )}
      </div>
    </div>
  )
}
