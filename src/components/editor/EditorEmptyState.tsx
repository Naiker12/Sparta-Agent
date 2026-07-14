export function EmptyEditorState({
  projectName,
  hasRootPath,
  explorerVisible,
  onShowExplorer,
  onOpenFolder,
  onCloseProject,
  onClose,
}: {
  projectName?: string
  hasRootPath: boolean
  explorerVisible: boolean
  onShowExplorer: () => void
  onOpenFolder: () => void
  onCloseProject: () => void
  onClose: () => void
}) {
  const noProject = !hasRootPath

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      color: 'var(--text-muted)',
      fontSize: 12,
      fontFamily: 'var(--font-ui)',
      background: 'var(--bg-surface)',
    }}>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
        {projectName ? `Proyecto: ${projectName}` : 'Ningún proyecto seleccionado'}
      </div>
      <p>
        {noProject
          ? 'Abrí una carpeta de proyecto para empezar a trabajar con el editor y el agente.'
          : !explorerVisible
          ? 'El explorador de archivos está oculto. Mostralo para elegir un archivo.'
          : 'Selecciona un archivo del explorador para empezar a editar.'}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        {noProject && (
          <button
            onClick={onOpenFolder}
            style={{
              padding: '6px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Abrir carpeta
          </button>
        )}
        {!noProject && (
          <button
            onClick={onCloseProject}
            style={{
              padding: '6px 16px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cerrar proyecto
          </button>
        )}
        {!explorerVisible && (
          <button
            onClick={onShowExplorer}
            style={{
              padding: '6px 16px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Mostrar explorador
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            padding: '6px 16px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-normal)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cerrar editor
        </button>
      </div>
    </div>
  )
}
