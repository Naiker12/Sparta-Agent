import { FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useProjectStore } from '@/stores/project.store'

interface ProjectFolderPickerProps {
  projectId: string
}

export function ProjectFolderPicker({ projectId }: ProjectFolderPickerProps) {
  const setProjectRootPath = useProjectStore((s) => s.setProjectRootPath)

  async function handleOpenFolder() {
    if (!window.fs) {
      toast.error('File system not available')
      return
    }
    try {
      const path = await window.fs.openFolderDialog()
      if (path) {
        setProjectRootPath(projectId, path)
        toast.success('Project folder opened')
      }
    } catch (err) {
      toast.error('Failed to open folder', { description: (err as Error).message })
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
