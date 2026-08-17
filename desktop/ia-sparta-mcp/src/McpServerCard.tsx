import React, { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plug, Trash2, Pencil, ChevronDown, Wifi, WifiOff, Wrench, MoreHorizontal, Shield, Unplug } from 'lucide-react'
import type { MCPServer } from 'ia-sparta-core'
import { useMCPStore } from 'ia-sparta-core'
import { ConfirmDeleteDialog, BrandIcon, toast, Switch } from 'ia-sparta-design-system'
import { McpToolItem } from './McpToolItem'
import { getVendorForServer } from './data/mcp-catalog'
import { REFERENCE_TOOLS_CATALOG } from './data/mcp-reference-tools'
import { useTranslation } from 'ia-sparta-i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'ia-sparta-design-system'

interface McpServerCardProps {
  server: MCPServer
  onEdit: (server: MCPServer) => void
  onViewCapabilities?: () => void
}

export function McpServerCard({ server, onEdit, onViewCapabilities }: McpServerCardProps) {
  const { removeServer, toggleServer } = useMCPStore()
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  const [hasOAuthToken, setHasOAuthToken] = useState(false)

  useEffect(() => {
    if (server.config.auth_type === 'oauth2') {
      const electronObj = (window as unknown as { electron?: { ipcRenderer?: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } } }).electron
      const checkToken = async () => {
        try {
          const has = await electronObj?.ipcRenderer?.invoke('vault:hasKey', `mcp:${server.id}:oauth_token`)
          if (has) {
            setHasOAuthToken(true)
            return
          }
        } catch { /* ignore */ }
        try {
          if (typeof window !== 'undefined' && (window as any).spartaVault?.get) {
            const tok = (window as any).spartaVault.get(`mcp:${server.id}:oauth_token`)
            if (tok) setHasOAuthToken(true)
          }
        } catch { /* ignore */ }
      }
      checkToken()
    }
  }, [server.id, server.config.auth_type])

  const isEnabled = server.config.enabled
  const isConnected = server.connected || hasOAuthToken || (isEnabled && (server.type === 'stdio' || server.config.auth_type !== 'oauth2'))
  const refToolsCount = REFERENCE_TOOLS_CATALOG[server.id]?.length ?? 0
  const toolsCount = server.tools.length > 0 ? server.tools.length : refToolsCount
  const brandVendor = getVendorForServer(server.id)

  async function handleDisconnect(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      if (typeof window !== 'undefined') {
        const win = window as any
        if (win.electron?.ipcRenderer?.invoke) {
          await win.electron.ipcRenderer.invoke('vault:deleteKey', `mcp:${server.id}:oauth_token`)
        } else if (win.electronAPI?.invoke) {
          await win.electronAPI.invoke('vault:deleteKey', `mcp:${server.id}:oauth_token`)
        }
        if (win.spartaVault?.delete) {
          win.spartaVault.delete(`mcp:${server.id}:oauth_token`)
        }
      }
    } catch { /* ignore */ }
    setHasOAuthToken(false)
    try { (useMCPStore.getState() as any).setConnected?.(server.id, false) } catch { /* ignore */ }
    toast.info(`Conector ${server.name} desconectado.`)
  }

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onViewCapabilities?.()}
        style={{
          borderRadius: 18,
          border: '1px solid var(--border-normal)',
          borderLeftWidth: isConnected ? 4 : 1,
          borderLeftColor: isConnected ? 'var(--status-ok)' : 'var(--border-normal)',
          borderLeftStyle: 'solid',
          background: 'var(--bg-surface)',
          opacity: !isEnabled ? 0.76 : 1,
          transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
          boxShadow: hovered ? '0 18px 40px rgba(0,0,0,0.08)' : '0 10px 25px rgba(0,0,0,0.05)',
          transform: hovered ? 'translateY(-1px)' : 'none',
          cursor: onViewCapabilities ? 'pointer' : undefined,
        }}
      >
        {/* ── Main row ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>

          {/* Icon */}
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isConnected ? 'color-mix(in srgb, var(--status-ok) 12%, transparent)' : 'var(--bg-elevated)',
            border: isConnected ? '1px solid color-mix(in srgb, var(--status-ok) 25%, transparent)' : '1px solid var(--border-normal)',
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
                  background: 'color-mix(in srgb, var(--status-warn) 12%, transparent)', color: 'var(--status-warn)',
                }}>
                  Archivado
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {isConnected ? (
                  <Wifi size={9} strokeWidth={2} style={{ color: 'var(--status-ok)' }} />
                ) : server.config.auth_type === 'oauth2' ? (
                  <Shield size={9} strokeWidth={2} style={{ color: 'var(--status-warn)' }} />
                ) : (
                  <WifiOff size={9} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
                )}
                <span style={{
                  fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-ui)',
                  color: isConnected ? 'var(--status-ok)' : server.config.auth_type === 'oauth2' ? 'var(--status-warn)' : 'var(--text-muted)',
                }}>
                  {isConnected
                    ? (hasOAuthToken ? 'Conectado / Autorizado' : (t('mcp.statusConnected') ?? 'Conectado / Listo'))
                    : server.config.auth_type === 'oauth2'
                    ? 'Pendiente de autorización OAuth'
                    : isEnabled
                    ? 'Listo para conectar'
                    : 'Desactivado'
                  }
                </span>
              </div>

              {/* Tools count — clickable */}
              {toolsCount > 0 && (
                <>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>·</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                      background: 'none', border: 'none', padding: 0, fontFamily: 'var(--font-ui)',
                      color: 'var(--text-secondary)', fontSize: 10,
                    }}
                  >
                    <Wrench size={9} strokeWidth={2} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{toolsCount}</span>
                    <span>{t('mcp.tools') ?? 'herramientas'}</span>
                    <ChevronDown
                      size={10} strokeWidth={2}
                      style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>
                </>
              )}
            </div>
            {!isConnected && server.lastError && (
              <div title={server.lastError} style={{
                marginTop: 5, fontSize: 10, color: 'var(--status-warn)',
                fontFamily: 'var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {server.lastError}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Switch toggle */}
            <div onClick={(e) => e.stopPropagation()}>
              <Switch
                checked={isEnabled}
                onCheckedChange={() => toggleServer(server.id)}
                title={isEnabled ? t('mcp.deactivate') ?? 'Desactivar' : t('mcp.activate') ?? 'Activar'}
              />
            </div>

            {/* More menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
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
              <DropdownMenuContent align="end" className="w-44 text-xs" onClick={(e) => e.stopPropagation()}>
                {isConnected && (
                  <>
                    <DropdownMenuItem
                      onClick={handleDisconnect}
                      className="gap-2 text-xs cursor-pointer text-amber-500 focus:text-amber-500"
                    >
                      <Unplug size={12} />
                      {t('mcp.disconnect') ?? 'Desconectar'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onEdit(server) }}
                  className="gap-2 text-xs cursor-pointer"
                >
                  <Pencil size={12} />
                  {t('mcp.edit') ?? 'Editar'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteOpen(true) }}
                  className="gap-2 text-xs cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 size={12} />
                  {t('mcp.deleteServer') ?? 'Eliminar conector'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Tools list ───────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {expanded && toolsCount > 0 && (
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
                    {t('mcp.availableTools') ?? 'Herramientas Disponibles'}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
                    background: 'var(--bg-active)', padding: '1px 5px', borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {toolsCount}
                  </span>
                </div>
                {/* Tool items */}
                <div>
                  {(server.tools.length > 0 ? server.tools : (REFERENCE_TOOLS_CATALOG[server.id] ?? [])).map((tool, i) => (
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
