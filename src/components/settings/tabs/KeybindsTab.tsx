import { SettingGroup } from './primitives'

interface Keybind {
  id: string
  label: string
  description?: string
  combo: string
}

const KEYBINDS: Keybind[] = [
  { id: 'new-session', label: 'Nueva sesión', description: 'Crear una conversación nueva.', combo: 'Ctrl + N' },
  { id: 'open-settings', label: 'Abrir configuración', combo: 'Ctrl + ,' },
  { id: 'toggle-sidebar', label: 'Mostrar / ocultar sidebar', combo: 'Ctrl + B' },
  { id: 'toggle-terminal', label: 'Mostrar / ocultar terminal', combo: 'Ctrl + `' },
  { id: 'switch-chat', label: 'Ir a chat', combo: 'Ctrl + 1' },
  { id: 'switch-editor', label: 'Ir a editor', combo: 'Ctrl + 2' },
  { id: 'switch-terminal', label: 'Ir a terminal', combo: 'Ctrl + 3' },
  { id: 'switch-agents', label: 'Ir a agentes', combo: 'Ctrl + 4' },
  { id: 'send-message', label: 'Enviar mensaje', combo: 'Enter' },
  { id: 'newline', label: 'Salto de línea', combo: 'Shift + Enter' },
  { id: 'search', label: 'Buscar en sidebar', combo: 'Ctrl + K' },
  { id: 'close-modal', label: 'Cerrar modal', combo: 'Escape' },
]

export function KeybindsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title="Atajos de teclado"
        description="Atajos globales de la aplicación. Personalización próximamente."
      >
        <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
          {KEYBINDS.map((kb) => (
            <div
              key={kb.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '10px 0',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 500,
                  }}
                >
                  {kb.label}
                </div>
                {kb.description && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-ui)',
                      marginTop: 2,
                    }}
                  >
                    {kb.description}
                  </div>
                )}
              </div>
              <KbdCombo combo={kb.combo} />
            </div>
          ))}
        </div>
      </SettingGroup>
    </div>
  )
}

function KbdCombo({ combo }: { combo: string }) {
  const parts = combo.split('+').map((p) => p.trim())
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {parts.map((p, i) => (
        <span key={i}>
          <kbd
            style={{
              display: 'inline-block',
              padding: '2px 6px',
              fontSize: 10.5,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-sm)',
              minWidth: 18,
              textAlign: 'center',
            }}
          >
            {p}
          </kbd>
        </span>
      ))}
    </div>
  )
}
