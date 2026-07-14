import { FolderOpen, FileSearch, Command } from 'lucide-react'

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
  const Icon = noProject ? FolderOpen : FileSearch

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-surface)',
      animation: 'fadeIn 0.18s ease-out',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '32px 40px',
        maxWidth: 380,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 4px 24px color-mix(in srgb, var(--text-primary) 8%, transparent)',
        animation: 'scaleIn 0.18s ease-out',
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: hasRootPath
            ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
            : 'var(--bg-hover)',
          boxShadow: hasRootPath
            ? '0 0 20px color-mix(in srgb, var(--accent) 15%, transparent)'
            : 'none',
        }}>
          <Icon
            size={24}
            strokeWidth={1.25}
            style={{ color: hasRootPath ? 'var(--accent)' : 'var(--text-muted)' }}
          />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'var(--font-ui)',
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}>
            {projectName ? projectName : 'Sin proyecto abierto'}
          </div>
          <p style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            maxWidth: 320,
            margin: 0,
          }}>
            {noProject
              ? 'Abrí una carpeta de proyecto para empezar a trabajar con el editor y el agente.'
              : !explorerVisible
              ? 'El explorador de archivos está oculto. Mostralo para elegir un archivo.'
              : 'Selecciona un archivo del explorador para empezar a editar.'}
          </p>
          {!noProject && explorerVisible && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              marginTop: 8,
              fontSize: 11,
              color: 'var(--text-muted)',
            }}>
              <Command size={10} />
              <span>
                <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Cmd+P</strong>{' '}
                para buscar un archivo rápido
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          {noProject && (
            <button
              onClick={onOpenFolder}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 16px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                transition: 'filter 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = '' }}
            >
              <FolderOpen size={14} />
              Abrir carpeta
            </button>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            {!noProject && (
              <button
                onClick={onCloseProject}
                style={{
                  flex: 1,
                  padding: '5px 12px',
                  background: 'transparent',
                  border: '1px solid var(--border-normal)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '' }}
              >
                Cerrar proyecto
              </button>
            )}
            {!explorerVisible && (
              <button
                onClick={onShowExplorer}
                style={{
                  flex: 1,
                  padding: '5px 12px',
                  background: 'transparent',
                  border: '1px solid var(--border-normal)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '' }}
              >
                Mostrar explorador
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '5px 12px',
                background: 'transparent',
                border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '' }}
            >
              Cerrar editor
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
