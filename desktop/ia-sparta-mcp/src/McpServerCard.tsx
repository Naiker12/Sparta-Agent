import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plug, Zap, Trash2, Pencil, ChevronDown, Wifi, WifiOff, Wrench, MoreHorizontal } from 'lucide-react'
import type { MCPServer } from 'ia-sparta-core'
import { useMCPStore } from 'ia-sparta-core'
import { ConfirmDeleteDialog } from 'ia-sparta-design-system'
import { BrandIcon } from 'ia-sparta-design-system'
import { McpToolItem } from './McpToolItem'
import { useTranslation } from 'ia-sparta-i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'ia-sparta-design-system'

const MCP_BRAND_ICONS: Record<string, string> = {
  Git: 'git',
  SQLite: 'sqlite',
  PostgreSQL: 'postgresql',
}

interface McpServerCardProps {
  server: MCPServer
  onEdit: (server: MCPServer) => void
}

export function McpServerCard({ server, onEdit }: McpServerCardProps) {
  const { removeServer, toggleServer } = useMCPStore()
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  const isConnected = server.connected
  const isEnabled = server.config.enabled
  const hasTools = server.tools.length > 0
  const brandVendor = MCP_BRAND_ICONS[server.name]

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderRadius: 10,
          border: isConnected
            ? '1px solid rgba(34,197,94,0.3)'
            : '1px solid var(--border-normal)',
          background: 'var(--bg-surface)',
          opacity: !isEnabled ? 0.6 : 1,
          transition: 'all 0.15s',
          boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
          ...(hovered && { borderColor: isConnected ? 'rgba(34,197,94,0.5)' : 'var(--border-strong)' }),
        }}
      >
        {/* ── Main row ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>

          {/* Icon */}
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isConnected ? 'rgba(34,197,94,0.1)' : 'var(--bg-elevated)',
            border: isConnected ? '1px solid rgba(34,197,94,0.2)' : '1px solid var(--border-normal)',
            color: isConnected ? 'var(--status-ok)' : 'var(--text-muted)',
          }}>
            {brandVendor
              ? <BrandIcon vendor={brandVendor} size={18} />
              : <Plug size={15} strokeWidth={1.5} />
            }
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
                {server.name}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                padding: '1px 5px', borderRadius: 4, fontFamily: 'var(--font-mono)',
                background: 'var(--bg-active)', color: 'var(--text-muted)',
              }}>
                {server.type}
              </span>
              {server.config.maintained === false && (
                <span style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: '0.03em',
                  padding: '1px 5px', borderRadius: 4, fontFamily: 'var(--font-ui)',
                  background: 'rgba(234,179,8,0.12)', color: 'rgb(234,179,8)',
                }}>
                  Archivado
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {isConnected
                  ? <Wifi size={9} strokeWidth={2} style={{ color: 'var(--status-ok)' }} />
                  : <WifiOff size={9} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
                }
                <span style={{
                  fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-ui)',
                  color: isConnected ? 'var(--status-ok)' : 'var(--text-muted)',
                }}>
                  {isConnected ? t('mcp.statusConnected') : t('mcp.statusDisconnected')}
                </span>
              </div>

              {/* Tools count — clickable */}
              {hasTools && (
                <>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>·</span>
                  <button
                    onClick={() => setExpanded(!expanded)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                      background: 'none', border: 'none', padding: 0, fontFamily: 'var(--font-ui)',
                      color: 'var(--text-secondary)', fontSize: 10,
                    }}
                  >
                    <Wrench size={9} strokeWidth={2} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{server.tools.length}</span>
                    <span>{t('mcp.tools')}</span>
                    <ChevronDown
                      size={10} strokeWidth={2}
                      style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Power toggle */}
            <button
              onClick={() => toggleServer(server.id)}
              title={isEnabled ? t('mcp.deactivate') : t('mcp.activate')}
              style={{
                width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: isEnabled ? '1px solid rgba(34,197,94,0.25)' : '1px solid var(--border-subtle)',
                background: isEnabled ? 'rgba(34,197,94,0.1)' : 'var(--bg-elevated)',
                color: isEnabled ? 'var(--status-ok)' : 'var(--text-muted)',
                transition: 'all 0.12s',
              }}
            >
              <Zap size={11} strokeWidth={2} />
            </button>

            {/* More menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                style={{
                  width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  transition: 'all 0.12s', outline: 'none',
                }}
              >
                <MoreHorizontal size={13} strokeWidth={2} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 text-xs">
                <DropdownMenuItem
                  onClick={() => onEdit(server)}
                  className="gap-2 text-xs cursor-pointer"
                >
                  <Pencil size={12} />
                  {t('mcp.edit')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 size={12} />
                  {t('mcp.deleteServer')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Tools list ───────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {expanded && hasTools && (
            <motion.div
              key="tools"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ margin: '0 10px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                {/* Tools header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-elevated)',
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <Wrench size={9} strokeWidth={2.5} />
                    {t('mcp.availableTools')}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
                    background: 'var(--bg-active)', padding: '1px 5px', borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {server.tools.length}
                  </span>
                </div>
                {/* Tool items */}
                <div>
                  {server.tools.map((tool, i) => (
                    <div key={tool.name} style={i > 0 ? { borderTop: '1px solid var(--border-subtle)' } : {}}>
                      <McpToolItem tool={tool} />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        itemLabel={server.name}
        onConfirm={() => removeServer(server.id)}
      />
    </>
  )
}
