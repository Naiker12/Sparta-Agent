import { useState, useCallback } from 'react'
import { FolderOpen } from 'lucide-react'
import { useProjectStore } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import { toastReplace } from 'ia-sparta-core'

interface ProjectFolderPickerProps {
  projectId: string
}

export function ProjectFolderPicker({ projectId }: ProjectFolderPickerProps) {
  const setProjectRootPath = useProjectStore((s) => s.setProjectRootPath)
  const { t } = useTranslation()
  const [dragOver, setDragOver] = useState(false)

  async function handleOpenFolder() {
    if (!window.fs) {
      toastReplace('error', 'folder-picker', t('editor.fsNotAvailable'))
      return
    }
    try {
      const path = await window.fs.openFolderDialog()
      if (path) {
        setProjectRootPath(projectId, path)
        await window.fs.setWorkspaceRoot(path)
        toastReplace('success', 'folder-picker', t('editor.folderOpened'))
      }
    } catch (err) {
      toastReplace('error', 'folder-picker', t('editor.folderOpenFailed'), {
        description: (err as Error).message,
      })
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length === 0) return
    const file = files[0] as File & { path?: string }
    const path = file.path ?? file.webkitRelativePath
    if (!path || !window.fs) return
    try {
      setProjectRootPath(projectId, path)
      await window.fs.setWorkspaceRoot(path)
      toastReplace('success', 'folder-picker', t('editor.folderOpened'))
    } catch (err) {
      toastReplace('error', 'folder-picker', t('editor.folderOpenFailed'), {
        description: (err as Error).message,
      })
    }
  }, [projectId, setProjectRootPath, t])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      background: 'var(--bg-surface)',
      animation: 'fadeIn 0.18s ease-out',
    }}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: '32px 40px',
          maxWidth: 380,
          background: dragOver
            ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))'
            : 'var(--bg-elevated)',
          border: dragOver
            ? '2px dashed var(--accent)'
            : '1px dashed var(--border-normal)',
          borderRadius: 'var(--radius-xl)',
          animation: 'scaleIn 0.18s ease-out',
          transition: 'all 0.2s ease',
          boxShadow: dragOver
            ? '0 0 24px color-mix(in srgb, var(--accent) 15%, transparent)'
            : 'none',
        }}
      >
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: dragOver
            ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
            : 'var(--bg-hover)',
          transition: 'all 0.2s ease',
          animation: dragOver ? undefined : 'pulse 3s ease-in-out infinite',
        }}>
          <FolderOpen
            size={24}
            strokeWidth={1.25}
            style={{
              color: dragOver ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'color 0.2s',
            }}
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
            {dragOver ? 'Soltá la carpeta aquí' : 'Abrir proyecto'}
          </div>
          <p style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            maxWidth: 280,
            margin: 0,
          }}>
            {dragOver
              ? 'Soltá para abrir esta carpeta como proyecto'
              : 'Seleccioná una carpeta para empezar a trabajar con el editor y el agente.'}
          </p>
        </div>

        {!dragOver && (
          <button
            onClick={handleOpenFolder}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 20px',
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
      </div>
    </div>
  )
}
