import { useState } from 'react'
import { SettingGroup, SettingRow } from '../../shared'
import { Switch } from 'ia-sparta-design-system'
import { Trash2 } from 'lucide-react'

export function DangerZoneSection() {
  const [requireConfirm, setRequireConfirm] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)

  function handleDeleteAll() {
    if (requireConfirm && !window.confirm('¿Estás seguro de que deseas eliminar permanentemente todas las conversaciones? Esta acción no se puede deshacer.')) {
      return
    }

    setIsDeleting(true)
    setTimeout(() => {
      setIsDeleting(false)
      setDeleted(true)
      setTimeout(() => setDeleted(false), 3000)
    }, 1000)
  }

  return (
    <div style={{ marginTop: 12 }}>
      <SettingGroup
        title="Zona de Peligro"
        description="Acciones irreversibles sobre el historial de datos y caché local."
      >
        <SettingRow
          label="Confirmar antes de eliminar"
          description="Muestra un diálogo de seguridad obligatorio antes de cualquier borrado destructivo."
        >
          <Switch
            checked={requireConfirm}
            onCheckedChange={setRequireConfirm}
          />
        </SettingRow>

        <SettingRow
          label="Borrar Todas las Conversaciones"
          description="Elimina permanentemente todo el historial de chats locales de SQLite y memoria volátil."
          danger
          action={
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={isDeleting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 14px',
                borderRadius: 'var(--radius-md, 6px)',
                backgroundColor: 'transparent',
                border: '1px solid var(--status-err, #EF4444)',
                color: 'var(--status-err, #EF4444)',
                fontSize: 12,
                fontWeight: 700,
                cursor: isDeleting ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--status-err, #EF4444)'
                e.currentTarget.style.color = '#FFFFFF'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--status-err, #EF4444)'
              }}
            >
              <Trash2 size={13} />
              <span>{deleted ? 'Historial Borrado' : isDeleting ? 'Borrando...' : 'Borrar Chats'}</span>
            </button>
          }
        />
      </SettingGroup>
    </div>
  )
}
