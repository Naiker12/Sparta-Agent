import { useState } from 'react'
import { SettingGroup } from '../../shared'
import { Switch } from 'ia-sparta-design-system'
import {
  GripVertical,
  SquarePen,
  Zap,
  Plug,
  Brain,
  Hash,
  Clock,
  MoreHorizontal,
} from 'lucide-react'

function HubGridIcon({ size = 15, color = 'var(--text-secondary)' }: { size?: string | number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  )
}

interface NavItem {
  id: string
  label: string
  icon: (props: { size?: string | number; color?: string }) => React.ReactNode
  enabled: boolean
  fixed?: boolean
}

export function SidebarNavSection() {
  const [items, setItems] = useState<NavItem[]>([
    { id: 'new_chat', label: 'Nuevo chat', icon: SquarePen, enabled: true, fixed: true },
    { id: 'models', label: 'Centro de modelos', icon: HubGridIcon, enabled: true },
    { id: 'skills', label: 'Habilidades (Skills)', icon: Zap, enabled: true },
    { id: 'mcp', label: 'Servidores MCP & Conectores', icon: Plug, enabled: true },
    { id: 'memory', label: 'Memoria Semántica & Contexto', icon: Brain, enabled: true },
    { id: 'channels', label: 'Canales de Comunicación', icon: Hash, enabled: false },
    { id: 'history', label: 'Historial de Sesiones', icon: Clock, enabled: false },
  ])

  function toggleItem(id: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id && !it.fixed ? { ...it, enabled: !it.enabled } : it))
    )
  }

  const disabledCount = items.filter((it) => !it.fixed && !it.enabled).length

  return (
    <SettingGroup
      title="Navegación de la barra lateral"
      description="Fija y reordena las pestañas activas de la barra lateral de Sparta. Las pestañas sin fijar se agrupan en el menú «Más». «Nuevo chat» queda fijo."
    >
      <div
        style={{
          margin: 12,
          backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg, 12px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {items.map((item, index) => {
          const Icon = item.icon
          const isDimmed = !item.fixed && !item.enabled
          const isLast = index === items.length - 1 && disabledCount === 0
          const isDividerBelow = item.fixed

          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 14px',
                borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                borderBottomWidth: isDividerBelow ? 1 : 1,
                gap: 12,
                opacity: isDimmed ? 0.45 : 1,
                transition: 'opacity 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {item.fixed ? (
                  <div style={{ width: 14 }} />
                ) : (
                  <GripVertical size={14} color="var(--text-muted)" style={{ cursor: 'grab' }} />
                )}
                <Icon size={15} color={isDimmed ? 'var(--text-muted)' : 'var(--text-secondary)'} />
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: isDimmed ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {item.label}
                </span>
              </div>

              {!item.fixed && (
                <Switch
                  checked={item.enabled}
                  onCheckedChange={() => toggleItem(item.id)}
                />
              )}
            </div>
          )
        })}

        {disabledCount > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 14px 9px 38px',
              fontSize: 12,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
              backgroundColor: 'rgba(0,0,0,0.03)',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <MoreHorizontal size={14} />
            <span>Más ({disabledCount})</span>
          </div>
        )}
      </div>
    </SettingGroup>
  )
}
