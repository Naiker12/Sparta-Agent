import { useState } from 'react'
import { SettingGroup } from '../../shared'
import { Switch } from 'ia-sparta-design-system'
import {
  GripVertical,
  Settings,
  Moon,
  Keyboard,
  Wrench,
  HelpCircle,
  LogOut,
} from 'lucide-react'

function PowerIcon({ size = 15, color = 'var(--text-secondary)' }: { size?: string | number; color?: string }) {
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
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  )
}

interface MenuItem {
  id: string
  label: string
  icon: (props: { size?: string | number; color?: string }) => React.ReactNode
  enabled: boolean
  fixed?: boolean
}

export function ProfileMenuSection() {
  const [items, setItems] = useState<MenuItem[]>([
    { id: 'settings', label: 'Configuración', icon: Settings, enabled: true, fixed: true },
    { id: 'dark_mode', label: 'Modo Oscuro / Tema', icon: Moon, enabled: true },
    { id: 'keybinds', label: 'Atajos de Teclado', icon: Keyboard, enabled: true },
    { id: 'tools', label: 'Herramientas IA & Conectores', icon: Wrench, enabled: true },
    { id: 'help', label: 'Ayuda & Documentación', icon: HelpCircle, enabled: true, fixed: true },
    { id: 'logout', label: 'Cerrar Sesión', icon: LogOut, enabled: true, fixed: true },
    { id: 'shutdown', label: 'Apagar / Salir', icon: PowerIcon, enabled: true, fixed: true },
  ])

  function toggleItem(id: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id && !it.fixed ? { ...it, enabled: !it.enabled } : it))
    )
  }

  return (
    <SettingGroup
      title="Menú de la barra lateral (Perfil)"
      description="Muestra, oculta y reordena los accesos rápidos del menú de usuario de Sparta. Configuración, Ayuda, Cerrar sesión y Apagar quedan fijos."
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
          const isLast = index === items.length - 1
          const isDividerAbove = item.id === 'dark_mode' || item.id === 'help'

          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 14px',
                borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                borderTop: isDividerAbove ? '1px solid var(--border-subtle)' : 'none',
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
                <Icon
                  size={15}
                  color={isDimmed ? 'var(--text-muted)' : 'var(--text-secondary)'}
                />
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
      </div>
    </SettingGroup>
  )
}
