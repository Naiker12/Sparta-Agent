import { PanelLeft, FolderX, X } from 'lucide-react'

export function EditorToolbar({
  explorerVisible,
  onToggleExplorer,
  projectName,
  onCloseProject,
  onCloseEditor,
}: {
  explorerVisible: boolean
  onToggleExplorer: () => void
  projectName?: string
  onCloseProject: () => void
  onCloseEditor: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderBottom: '1px solid var(--border-normal)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}
    >
      <button
        onClick={onToggleExplorer}
        title="Mostrar/ocultar explorador (Ctrl+B)"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          border: 'none',
          background: explorerVisible ? 'var(--bg-active)' : 'transparent',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        <PanelLeft size={14} />
      </button>

      <div style={{ flex: 1 }} />

      {projectName && (
        <>
          <button
            onClick={onCloseProject}
            title="Cerrar proyecto"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              border: 'none',
              background: 'transparent',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <FolderX size={12} />
            <span>Cerrar proyecto</span>
          </button>
          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 4px' }} />
        </>
      )}

      <button
        onClick={onCloseEditor}
        title="Cerrar editor"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          border: 'none',
          background: 'transparent',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
