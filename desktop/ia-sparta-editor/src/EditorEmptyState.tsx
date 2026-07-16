import { useState, useCallback } from 'react'
import { FolderOpen, FileSearch, Command, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/i18n'
import { useProjectStore } from '@/stores/project.store'
import { toastReplace } from '@/lib/toast-helpers'

interface EmptyEditorStateProps {
  projectName?: string
  hasRootPath: boolean
  explorerVisible: boolean
  onShowExplorer: () => void
  onOpenFolder: () => void
  onCloseProject: () => void
  onClose: () => void
}

export function EmptyEditorState({
  projectName,
  hasRootPath,
  explorerVisible,
  onShowExplorer,
  onOpenFolder,
  onCloseProject,
  onClose,
}: EmptyEditorStateProps) {
  const { t } = useTranslation()
  const noProject = !hasRootPath
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length === 0) return
    const file = files[0] as File & { path?: string }
    const path = file.path ?? file.webkitRelativePath
    if (!path || !window.fs) return
    try {
      let project = useProjectStore.getState().getActiveProject()
      if (!project) {
        const folderName = path.split(/[/\\]/).pop() ?? 'Proyecto'
        useProjectStore.getState().addProject(folderName)
        project = useProjectStore.getState().getActiveProject()
      }
      if (project) {
        useProjectStore.getState().setProjectRootPath(project.id, path)
        await window.fs.setWorkspaceRoot(path)
        toastReplace('success', 'folder-picker', t('editor.folderOpened'))
      }
    } catch (err) {
      toastReplace('error', 'folder-picker', t('editor.folderOpenFailed'), {
        description: (err as Error).message,
      })
    }
  }, [t])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 animate-in fade-in duration-200"
      style={{
        background: dragOver
          ? 'color-mix(in srgb, var(--accent) 6%, var(--bg-surface))'
          : 'var(--bg-surface)',
        border: dragOver ? '2px dashed var(--accent)' : '2px dashed transparent',
        transition: 'all 0.2s ease',
        cursor: dragOver ? 'copy' : 'default',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: dragOver
            ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
            : 'var(--bg-hover)',
          boxShadow: dragOver
            ? '0 0 32px color-mix(in srgb, var(--accent) 20%, transparent)'
            : 'none',
          transition: 'all 0.25s ease',
          transform: dragOver ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        {dragOver ? (
          <Upload size={26} strokeWidth={1.5} style={{ color: 'var(--accent)', transition: 'color 0.2s' }} />
        ) : noProject ? (
          <FolderOpen size={26} strokeWidth={1.25} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <FileSearch size={26} strokeWidth={1.25} style={{ color: 'var(--accent)' }} />
        )}
      </div>

      {/* Text */}
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'var(--font-ui)',
            color: dragOver ? 'var(--accent)' : 'var(--text-primary)',
            marginBottom: 6,
            transition: 'color 0.2s',
          }}
        >
          {dragOver
            ? 'Soltá la carpeta aquí'
            : (projectName || t('editor.empty.noProjectTitle'))}
        </h3>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          {dragOver
            ? 'Soltá para abrir esta carpeta como proyecto'
            : noProject
            ? t('editor.empty.noProjectDesc')
            : !explorerVisible
            ? t('editor.empty.explorerHiddenDesc')
            : t('editor.empty.selectFileDesc')}
        </p>
        {!noProject && explorerVisible && !dragOver && (
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            <Command size={10} />
            <span dangerouslySetInnerHTML={{ __html: t('editor.empty.quickOpenHint') }} />
          </div>
        )}
      </div>

      {/* Actions */}
      {!dragOver && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', width: '100%', maxWidth: 260 }}>
          {noProject && (
            <Button onClick={onOpenFolder} className="w-full">
              <FolderOpen size={14} />
              {t('editor.empty.openFolder')}
            </Button>
          )}
          <div style={{ display: 'flex', gap: 6, width: '100%' }}>
            {!noProject && (
              <Button variant="outline" size="sm" className="flex-1" onClick={onCloseProject}>
                {t('editor.empty.closeProject')}
              </Button>
            )}
            {!explorerVisible && (
              <Button variant="outline" size="sm" className="flex-1" onClick={onShowExplorer}>
                {t('editor.empty.showExplorer')}
              </Button>
            )}
            <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
              {t('editor.empty.closeEditor')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

