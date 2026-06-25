import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plug, Power, Trash2, Edit2, ChevronDown, Wifi, WifiOff } from 'lucide-react'
import type { MCPServer } from '@/types'
import { useMCPStore } from '@/stores/mcp.store'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { BrandIcon } from '@/components/ui/BrandIcon'
import { McpToolItem } from './McpToolItem'

const MCP_BRAND_ICONS: Record<string, string> = {
  Git: 'git',
  SQLite: 'sqlite',
}

interface McpServerCardProps {
  server: MCPServer
  onEdit: (server: MCPServer) => void
}

export function McpServerCard({ server, onEdit }: McpServerCardProps) {
  const { removeServer, toggleServer } = useMCPStore()
  const [expanded, setExpanded] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const isConnected = server.connected
  const statusColor = isConnected ? 'var(--status-ok)' : 'var(--text-muted)'
  const statusLabel = isConnected ? 'Conectado' : 'Desconectado'
  const hasTools = server.tools.length > 0
  const brandVendor = MCP_BRAND_ICONS[server.name]

  return (
    <div
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        borderLeft: `3px solid ${statusColor}`,
        transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-elevated)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-input)' }}
    >
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {brandVendor ? (
            <BrandIcon vendor={brandVendor} size={16} />
          ) : (
            <Plug size={16} style={{ color: statusColor, flexShrink: 0 }} />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {server.name}
              </span>
              <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-active)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {server.type}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              {isConnected ? (
                <Wifi size={10} style={{ color: 'var(--status-ok)' }} />
              ) : (
                <WifiOff size={10} style={{ color: 'var(--text-muted)' }} />
              )}
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                {statusLabel}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                ·
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {server.tools.length} tools
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <IconButton
              onClick={() => toggleServer(server.id)}
              title={server.config.enabled ? 'Desactivar' : 'Activar'}
              color={server.config.enabled ? 'var(--status-ok)' : 'var(--text-muted)'}
            >
              <Power size={12} strokeWidth={1.5} />
            </IconButton>
            <IconButton onClick={() => onEdit(server)} title="Editar" color="var(--text-muted)">
              <Edit2 size={12} strokeWidth={1.5} />
            </IconButton>
            <IconButton
              onClick={() => setConfirmDeleteOpen(true)}
              title="Eliminar"
              color="var(--text-muted)"
              hoverColor="var(--status-err)"
            >
              <Trash2 size={12} strokeWidth={1.5} />
            </IconButton>
            {hasTools && (
              <IconButton
                onClick={() => setExpanded(!expanded)}
                title={expanded ? 'Ocultar tools' : 'Mostrar tools'}
                color="var(--text-muted)"
              >
                <ChevronDown
                  size={12}
                  strokeWidth={1.5}
                  style={{
                    transition: 'transform 0.15s',
                    transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  }}
                />
              </IconButton>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && hasTools && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '0 14px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Herramientas disponibles
              </div>
              {server.tools.map((tool) => (
                <McpToolItem key={tool.name} tool={tool} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        itemLabel={server.name}
        onConfirm={() => removeServer(server.id)}
      />
    </div>
  )
}

function IconButton({
  children,
  onClick,
  title,
  color,
  hoverColor,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  color: string
  hoverColor?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28,
        height: 28,
        background: 'none',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        color,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.1s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-hover)'
        if (hoverColor) e.currentTarget.style.color = hoverColor
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none'
        e.currentTarget.style.color = color
      }}
    >
      {children}
    </button>
  )
}
