import { FolderOpen } from 'lucide-react'
import { useProjectStore } from '@/stores/project.store'
import { useTranslation } from '@/i18n'
import { toastReplace } from '@/lib/toast-helpers'

interface ProjectFolderPickerProps {
  projectId: string
}

export function ProjectFolderPicker({ projectId }: ProjectFolderPickerProps) {
  const setProjectRootPath = useProjectStore((s) => s.setProjectRootPath)
  const { t } = useTranslation()

  async function handleOpenFolder() {
    if (!window.fs) {
      toastReplace('error', 'folder-picker', t('editor.fsNotAvailable'))
      return
    }
    try {
      const path = await window.fs.openFolderDialog()
      if (path) {
        setProjectRootPath(projectId, path)
        toastReplace('success', 'folder-picker', t('editor.folderOpened'))
      }
    } catch (err) {
      toastReplace('error', 'folder-picker', t('editor.folderOpenFailed'), {
        description: (err as Error).message,
      })
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 24,
      textAlign: 'center',
      color: 'var(--text-secondary)',
      fontSize: 12,
      fontFamily: 'var(--font-ui)',
    }}>
      <FolderOpen size={32} strokeWidth={1.2} style={{ color: 'var(--text-muted)' }} />
      <p>No hay una carpeta de proyecto abierta.</p>
      <button
        onClick={handleOpenFolder}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-normal)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: 12,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
        }}
      >
        <FolderOpen size={13} />
        Abrir carpeta
      </button>
    </div>
  )
}
