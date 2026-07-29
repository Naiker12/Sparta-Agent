import { useState } from 'react'
import { Check, Download, MoreHorizontal, Pencil, Trash2, Copy, Star, Zap } from 'lucide-react'
import type { Skill, DownloadableSkill } from 'ia-sparta-core'
import { useSkillStore } from 'ia-sparta-core'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  ConfirmDeleteDialog,
  SkillCategoryIcon,
} from 'ia-sparta-design-system'

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
  const [hovered, setHovered] = useState(false)

  const isInstalled = installed ?? false
  const isDownloadableSkill = isDownloadable ?? false
  const icon = skill.icon || '⚡'
  const tags = skill.tags || []
  const isActive = activeSkillIds.includes(skill.id)
  const isDownloadableType = 'version' in skill && 'category' in skill
  const downloadable = isDownloadableType ? (skill as DownloadableSkill) : null

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onOpen}
        style={{
          borderRadius: 18,
          border: '1px solid var(--border-normal)',
          borderLeftWidth: isActive ? 4 : 1,
          borderLeftColor: isActive ? 'var(--accent)' : 'var(--border-normal)',
          borderLeftStyle: 'solid',
          background: 'var(--bg-surface)',
          opacity: !isActive && !isDownloadableSkill ? 0.85 : 1,
          transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
          boxShadow: hovered ? '0 18px 40px rgba(0,0,0,0.08)' : '0 10px 25px rgba(0,0,0,0.05)',
          transform: hovered ? 'translateY(-1px)' : 'none',
          cursor: onOpen ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 14,
          gap: 10,
        }}
      >
        {/* Main row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {/* Category Icon */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive
                ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                : 'var(--bg-elevated)',
              border: isActive
                ? '1px solid color-mix(in srgb, var(--accent) 25%, transparent)'
                : '1px solid var(--border-normal)',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {skill.category ? (
              <SkillCategoryIcon category={skill.category} size={17} strokeWidth={2} />
            ) : (
              <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
            )}
          </div>

          {/* Title & Metadata */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {skill.name}
              </span>
              {skill.category && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '1px 5px',
                    borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                    color: 'var(--accent)',
                    flexShrink: 0,
                  }}
                >
                  {skill.category}
                </span>
              )}
            </div>

            {downloadable && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                by {downloadable.author}
              </span>
            )}
          </div>

          {/* Action power button & Dropdown menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
            {!isDownloadableSkill && onActivate && (
              <button
                type="button"
                onClick={onActivate}
                title={isActive ? 'Desactivar skill' : 'Activar skill'}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isActive
                    ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)'
                    : '1px solid var(--border-subtle)',
                  background: isActive
                    ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                    : 'var(--bg-elevated)',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'all 0.12s',
                  outline: 'none',
                }}
              >
                <Zap size={11} strokeWidth={2} />
              </button>
            )}

            {!isDownloadableSkill && (onEdit || onExport || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid transparent',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    transition: 'all 0.12s',
                    outline: 'none',
                  }}
                >
                  <MoreHorizontal size={13} strokeWidth={2} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36 text-xs">
                  {onEdit && (
                    <DropdownMenuItem onClick={onEdit} className="gap-2 text-xs cursor-pointer">
                      <Pencil size={12} />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {onExport && (
                    <DropdownMenuItem onClick={onExport} className="gap-2 text-xs cursor-pointer">
                      <Copy size={12} />
                      Exportar
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setConfirmDeleteOpen(true)}
                        className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                      >
                        <Trash2 size={12} />
                        Eliminar
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            margin: 0,
            lineHeight: 1.45,
            fontFamily: 'var(--font-ui)',
            display: '-webkit-box',
            WebkitLineClamp: expanded ? 'unset' : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {skill.description}
        </p>

        {/* Footer Tags & Installation button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {tags.slice(0, 3).map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: 4,
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--bg-active)',
                  color: 'var(--text-muted)',
                }}
              >
                {t}
              </span>
            ))}
          </div>

          {isDownloadableSkill && (
            isInstalled ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: 'var(--status-ok)', fontFamily: 'var(--font-ui)' }}>
                <Check size={11} strokeWidth={2} />
                Instalada
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onInstall?.() }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                }}
              >
                <Download size={11} strokeWidth={2} />
                Instalar
              </button>
            )
          )}
        </div>
      </div>

      {onDelete && (
        <ConfirmDeleteDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          itemLabel={skill.name}
          onConfirm={onDelete}
        />
      )}
    </>
  )
}
