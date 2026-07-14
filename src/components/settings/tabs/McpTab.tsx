import { useState } from 'react'
import { useMCPStore } from '@/stores/mcp.store'
import { SettingGroup } from './primitives'
import { Plus, Zap, Trash2 } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { AddMcpServerDialog } from '@/components/mcp/AddMcpServerDialog'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

export function McpTab() {
  const { servers, removeServer, toggleServer } = useMCPStore()
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [serverToDelete, setServerToDelete] = useState<string | null>(null)

  const serverToDeleteName = servers.find((s) => s.id === serverToDelete)?.name ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title={t('mcp.title')}
        description={t('mcp.desc')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
          {servers.map((server) => (
            <div
              key={server.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: server.connected ? 'var(--status-ok)' : 'var(--text-muted)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
                  {server.name}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {server.type} · {server.tools.length} {t('mcp.tools')}
                </div>
              </div>
              <button
                onClick={() => toggleServer(server.id)}
                title={server.config.enabled ? t('mcp.disable') : t('mcp.enable')}
                style={{
                  width: 26, height: 26,
                  background: 'none', border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: server.config.enabled ? 'var(--status-ok)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                <Zap size={12} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setServerToDelete(server.id)}
                title={t('mcp.delete')}
                style={{
                  width: 26, height: 26,
                  background: 'none', border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--destructive)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
              >
                <Trash2 size={12} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setDialogOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', marginTop: 4,
            background: 'none', border: '1px dashed var(--border-normal)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-muted)',
            fontSize: 11.5, fontFamily: 'var(--font-ui)', cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-normal)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <Plus size={13} strokeWidth={1.5} />
          {t('mcp.addServer')}
        </button>
      </SettingGroup>

      <AddMcpServerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />

      <ConfirmDeleteDialog
        open={serverToDelete !== null}
        onOpenChange={(open) => !open && setServerToDelete(null)}
        title={t('mcp.delete')}
        itemLabel={serverToDeleteName}
        onConfirm={() => {
          if (serverToDelete) removeServer(serverToDelete)
          setServerToDelete(null)
        }}
      />
    </div>
  )
}
