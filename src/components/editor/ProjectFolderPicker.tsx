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
        await window.fs.setWorkspaceRoot(path)
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
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
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
        border: '1px dashed var(--border-normal)',
        borderRadius: 'var(--radius-xl)',
        animation: 'scaleIn 0.18s ease-out',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-hover)',
          animation: 'pulse 3s ease-in-out infinite',
        }}>
          <FolderOpen size={24} strokeWidth={1.25} style={{ color: 'var(--text-muted)' }} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'var(--font-ui)',
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}>
            Abrir proyecto
          </div>
          <p style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            maxWidth: 280,
            margin: 0,
          }}>
            Seleccioná una carpeta para empezar a trabajar con el editor y el agente.
          </p>
        </div>

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
      </div>
    </div>
  )
}
