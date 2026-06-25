import { useState } from 'react'
import { ChevronDown, FolderOpen, Plus } from 'lucide-react'
import { useProjectStore } from '@/stores/project.store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ProjectDialog } from '@/components/projects/ProjectDialog'

export function ProjectSwitcher() {
  const { projects, activeProjectId, switchProject, addProject } = useProjectStore()
  const active = projects.find((p) => p.id === activeProjectId) || projects[0]
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleCreate() {
    setDialogOpen(true)
  }

  function handleCreateSubmit(name: string, description?: string) {
    addProject(name, description)
    setDialogOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            margin: '0 8px',
            background: 'var(--bg-active)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            width: 'calc(100% - 16px)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-normal)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
        >
          <span
            style={{
              fontSize: 14,
              width: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {active?.icon || '📁'}
          </span>
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'left',
              fontWeight: 500,
            }}
          >
            {active?.name || 'Sin proyecto'}
          </span>
          <ChevronDown size={12} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4}>
          <DropdownMenuLabel>Proyectos</DropdownMenuLabel>
          {projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => switchProject(p.id)}
              data-active={p.id === activeProjectId}
            >
              <FolderOpen size={13} strokeWidth={1.5} />
              <span style={{ flex: 1 }}>{p.name}</span>
              {p.id === activeProjectId && (
                <span style={{ fontSize: 10, color: 'var(--accent)' }}>●</span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCreate}>
            <Plus size={13} strokeWidth={1.5} />
            Nuevo proyecto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreateSubmit}
      />
    </>
  )
}
