import { Check, Download, MoreVertical, Pencil, Trash2, Copy, Star } from 'lucide-react'
import { useState } from 'react'
import type { Skill, DownloadableSkill } from 'ia-sparta-core'
import { useSkillStore } from 'ia-sparta-core'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  ConfirmDeleteDialog,
  SkillCategoryIcon,
} from 'ia-sparta-design-system'
import { SkillToggle } from './SkillToggle'

interface SkillCardProps {
  skill: Skill | DownloadableSkill
  installed?: boolean
  onActivate?: () => void
  onInstall?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onExport?: () => void
  onOpen?: () => void
  isDownloadable?: boolean
}

export function SkillCard({
  skill,
  installed,
  onActivate,
  onInstall,
  onEdit,
  onDelete,
  onExport,
  onOpen,
  isDownloadable,
}: SkillCardProps) {
  const { activeSkillIds } = useSkillStore()
  const [expanded, setExpanded] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const isInstalled = installed ?? false
  const isDownloadableSkill = isDownloadable ?? false
  const icon = skill.icon || '⚡'
  const tags = skill.tags || []
  const isActive = activeSkillIds.includes(skill.id)
  const isDownloadableType = 'version' in skill && 'category' in skill
  const downloadable = isDownloadableType ? (skill as DownloadableSkill) : null

  function handleActivate() {
    onActivate?.()
  }

  return (
    <Card
      size="sm"
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (onOpen && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onOpen()
        }
      }}
      className={`relative h-full flex flex-col justify-between transition-all duration-150 hover:shadow-md hover:border-primary/40 ${
        isActive ? 'border-l-4 border-l-primary ring-1 ring-primary/20' : ''
      } ${onOpen ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <CardHeader>
        <div className="flex items-center gap-2 min-w-0">
          {skill.category ? (
            <div className="p-1 rounded bg-muted text-foreground shrink-0">
              <SkillCategoryIcon category={skill.category} size={16} />
            </div>
          ) : (
            <span className="text-base shrink-0 leading-none">{icon}</span>
          )}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xs font-semibold text-foreground truncate font-sans">
              {skill.name}
            </CardTitle>
            {downloadable && (
              <CardDescription className="text-[10px] text-muted-foreground truncate">
                by {downloadable.author}
              </CardDescription>
            )}
          </div>
        </div>

        {!isDownloadableSkill && (onEdit || onExport || onDelete) && (
          <CardAction onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                  <MoreVertical size={12} strokeWidth={1.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit} className="gap-2 text-xs cursor-pointer">
                    <Pencil size={12} />
                    <span>Editar</span>
                  </DropdownMenuItem>
                )}
                {onExport && (
                  <DropdownMenuItem onClick={onExport} className="gap-2 text-xs cursor-pointer">
                    <Copy size={12} />
                    <span>Exportar</span>
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="gap-2 text-xs cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 size={12} />
                    <span>Eliminar</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-2 py-1">
        <p className={`text-xs text-muted-foreground leading-relaxed m-0 ${expanded ? '' : 'line-clamp-2'}`}>
          {skill.description}
        </p>

        {skill.description.length > 80 && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            className="text-[10px] text-primary font-medium hover:underline p-0 border-0 bg-transparent cursor-pointer"
          >
            {expanded ? 'Ver menos' : 'Ver más'}
          </button>
        )}

        {isDownloadableSkill && downloadable && (
          <div className="flex items-center gap-1 pt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={10}
                strokeWidth={1.5}
                className={star <= 4 ? 'text-amber-500 fill-amber-500' : 'text-border'}
              />
            ))}
            <span className="text-[10px] text-muted-foreground ml-1 font-mono">
              ({downloadable.featured ? 'Destacado' : 'Popular'})
            </span>
          </div>
        )}

        {(tags.length > 0 || skill.category || (skill.source && skill.source !== 'builtin')) && (
          <div className="flex flex-wrap gap-1 pt-1">
            {skill.category && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono uppercase tracking-wider text-primary border-primary/30">
                {skill.category}
              </Badge>
            )}
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-mono font-normal">
                {t}
              </Badge>
            ))}
            {skill.source && skill.source !== 'builtin' && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-mono text-muted-foreground">
                {skill.source}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-border/40">
        {isDownloadableSkill ? (
          isInstalled ? (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
              <Check size={12} strokeWidth={2} />
              Instalada
            </div>
          ) : (
            <Button size="sm" onClick={onInstall} className="h-7 text-xs gap-1.5 px-3">
              <Download size={12} strokeWidth={2} />
              Instalar
            </Button>
          )
        ) : (
          <div className="flex items-center justify-between w-full" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wider">
              {isActive ? 'Activa' : 'Inactiva'}
            </span>
            <SkillToggle
              active={isActive}
              onChange={() => handleActivate()}
              ariaLabel={`${isActive ? 'Desactivar' : 'Activar'} skill ${skill.name}`}
            />
          </div>
        )}
      </CardFooter>

      {onDelete && (
        <ConfirmDeleteDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          itemLabel={skill.name}
          onConfirm={onDelete}
        />
      )}
    </Card>
  )
}
