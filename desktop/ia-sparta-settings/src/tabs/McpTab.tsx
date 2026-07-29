import { useMCPStore } from 'ia-sparta-core'
import { SettingGroup } from './primitives'
import { Server, Wifi, Wrench, ArrowRight } from 'lucide-react'
import { useTranslation } from 'ia-sparta-i18n'
import { Button } from 'ia-sparta-design-system'

export function McpTab() {
  const { servers } = useMCPStore()
  const { t } = useTranslation()

  const connectedCount = servers.filter((s) => s.connected).length
  const totalCount = servers.length
  const totalTools = servers.reduce((acc, s) => acc + s.tools.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title={t('mcp.title')}
        description={t('mcp.desc')}
      >
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          padding: '12px 16px', background: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)', marginTop: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-normal)',
              color: 'var(--text-muted)',
            }}>
              <Server size={16} strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16, fontSize: 11,
                fontFamily: 'var(--font-ui)',
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  <Wifi size={10} style={{ color: 'var(--status-ok)', marginRight: 4 }} />
                  {connectedCount}/{totalCount} {t('mcp.connected')?.toLowerCase() ?? 'conectados'}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  <Wrench size={10} style={{ marginRight: 4 }} />
                  {totalTools} tools
                </span>
              </div>
            </div>
            <Button
              onClick={() => {
                // Dispatch event to open MCP view in main panel
                window.dispatchEvent(new CustomEvent('sparta:open-mcp-view'))
              }}
              size="sm"
              variant="secondary"
              style={{ fontSize: 10, fontWeight: 600, gap: 4, height: 28 }}
            >
              {t('mcp.manageServers') || 'Gestionar'}
              <ArrowRight size={10} />
            </Button>
          </div>
        </div>

        <p style={{
          fontSize: 10.5, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.5,
          fontFamily: 'var(--font-ui)',
        }}>
          {t('mcp.settingsHint') || 'Abre la vista MCP completa para añadir, configurar y monitorizar servidores.'}
        </p>
      </SettingGroup>
    </div>
  )
}
