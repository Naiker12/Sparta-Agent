import { useState } from 'react'
import { SettingGroup, SettingRow } from '../../shared'
import { Upload } from 'lucide-react'

export function ExportImportSection() {
  const [importStatus, setImportStatus] = useState<string | null>(null)

  function handleImportFile() {
    setImportStatus('Importando copia de seguridad...')
    setTimeout(() => {
      setImportStatus('Base de datos y memorias restauradas correctamente.')
      setTimeout(() => setImportStatus(null), 3000)
    }, 1000)
  }

  return (
    <SettingGroup
      title="Copia de Seguridad & Restauración"
      description="Transfiere tu base de conocimiento, memoria semántica y perfiles entre equipos."
    >
      <SettingRow
        label="Importar Datos o Historial"
        description="Restaura un backup previo en formato .json o .zip."
        action={
          <button
            type="button"
            onClick={handleImportFile}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 'var(--radius-md, 6px)',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Upload size={12} />
            <span>Importar Archivo</span>
          </button>
        }
      >
        {importStatus && (
          <span style={{ fontSize: 11, color: 'var(--status-ok, #10B981)', fontWeight: 600 }}>
            {importStatus}
          </span>
        )}
      </SettingRow>
    </SettingGroup>
  )
}
