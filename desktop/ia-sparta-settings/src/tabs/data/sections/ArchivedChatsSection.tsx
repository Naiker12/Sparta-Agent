import { useState } from 'react'
import { SettingGroup, SettingRow } from '../../shared'
import { FileArchive, Download } from 'lucide-react'

export function ArchivedChatsSection() {
  const [archivedCount, setArchivedCount] = useState(14)
  const [isExporting, setIsExporting] = useState(false)
  const [exported, setExported] = useState(false)

  function handleExportAll() {
    setIsExporting(true)
    setTimeout(() => {
      setIsExporting(false)
      setExported(true)
      setTimeout(() => setExported(false), 2500)
    }, 800)
  }

  return (
    <SettingGroup
      title="Gestión de Conversaciones & Archivo"
      description="Administra el historial de sesiones archivadas y exporta tus conversaciones en formato Markdown/JSON."
    >
      <SettingRow
        label="Conversaciones Archivadas"
        description={`${archivedCount} sesiones archivadas para búsqueda rápida y no activas en la barra lateral.`}
        action={
          <button
            type="button"
            onClick={() => setArchivedCount((c) => Math.max(0, c - 1))}
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
            <FileArchive size={12} />
            <span>Gestionar ({archivedCount})</span>
          </button>
        }
      />

      <SettingRow
        label="Exportar Todas las Sesiones"
        description="Descarga un archivo ZIP o JSONL con todos tus chats, artefactos y prompts generados."
        action={
          <button
            type="button"
            onClick={handleExportAll}
            disabled={isExporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 'var(--radius-md, 6px)',
              backgroundColor: exported ? 'var(--status-ok, #10B981)' : 'var(--accent)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: isExporting ? 'default' : 'pointer',
            }}
          >
            <Download size={12} />
            <span>{exported ? 'Exportado' : isExporting ? 'Exportando...' : 'Exportar Todo'}</span>
          </button>
        }
      />
    </SettingGroup>
  )
}
