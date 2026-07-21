import { ChevronDown, FolderOpen } from 'lucide-react'
import { useProjectStore } from 'ia-sparta-core'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuTrigger,
} from 'ia-sparta-design-system'
import { cn } from 'ia-sparta-core'

export function ProjectSwitcher() {
  const { projects, activeProjectId, switchProject } = useProjectStore()
  const active = projects.find(p => p.id === activeProjectId) ?? projects[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(
        'flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5',
        'text-[13px] font-semibold text-[var(--text-primary)]',
        'bg-[var(--bg-active)] border border-[var(--border-normal)]',
        'cursor-pointer transition-colors hover:border-[var(--border-strong)]',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]',
      )}>
        <span className="text-sm leading-none flex-shrink-0">{active?.icon ?? '📁'}</span>
        <span className="flex-1 truncate text-left text-[13px] font-medium">
          {active?.name ?? 'Sin proyecto'}
        </span>
        <ChevronDown size={14} strokeWidth={2} className="text-[var(--text-muted)] flex-shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={4} className="w-48">
        <DropdownMenuLabel className="text-xs">Proyectos</DropdownMenuLabel>
        {projects.map(p => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => switchProject(p.id)}
            className="text-xs gap-2"
          >
            <FolderOpen size={13} strokeWidth={1.5} className="flex-shrink-0" />
            <span className="flex-1 truncate">{p.name}</span>
            {p.id === activeProjectId && (
              <span className="text-[var(--accent)] text-[10px]">●</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
