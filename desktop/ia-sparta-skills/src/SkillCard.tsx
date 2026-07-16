import { Check, Download, MoreVertical, Pencil, Trash2, Copy, Star } from 'lucide-react'
import { useState } from 'react'
import type { Skill, DownloadableSkill } from 'ia-sparta-core'
import { useSkillStore } from 'ia-sparta-core'
import { ConfirmDeleteDialog } from 'ia-sparta-design-system'
import { SkillToggle } from './SkillToggle'

interface SkillCardProps {
  skill: Skill | DownloadableSkill
  installed?: boolean
  onActivate?: () => void
  onInstall?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onExport?: () => void
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
  isDownloadable,
}: SkillCardProps) {
  const { activeSkillIds } = useSkillStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const isInstalled = installed ?? false
  const isDownloadableSkill = isDownloadable ?? false
  const icon = skill.icon || '\u26A1'
  const tags = skill.tags || []
  const isActive = activeSkillIds.includes(skill.id)
  const isDownloadableType = 'version' in skill && 'category' in skill
  const downloadable = isDownloadableType ? (skill as DownloadableSkill) : null

  function handleActivate() {
    onActivate?.()
  }

  return (
    <div
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        transition: 'all 0.15s',
        position: 'relative',
        overflow: 'hidden',
        borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = isActive ? 'var(--accent)' : 'var(--border-strong)'
        e.currentTarget.style.background = 'var(--bg-elevated)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isActive ? 'var(--accent)' : 'var(--border-subtle)'
        e.currentTarget.style.background = 'var(--bg-input)'
      }}
    >
      {isActive && !isDownloadableSkill && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: 8,
            padding: '1px 6px',
            borderRadius: 3,
            background: 'var(--accent)',
            color: 'white',
            fontFamily: 'var(--font-ui)',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          Activa
        </div>
      )}

      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {skill.name}
              </div>
              {downloadable && (
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: 1 }}>
                  {downloadable.author}
                </div>
              )}
            </div>
          </div>

          {!isDownloadableSkill && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
                style={{
                  width: 24, height: 24, background: 'none', border: 'none',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <MoreVertical size={12} strokeWidth={1.5} />
              </button>
              {menuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 9 }}
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute', right: 0, top: '100%', zIndex: 10,
                      background: 'var(--bg-modal)', border: '1px solid var(--border-normal)',
                      borderRadius: 'var(--radius-md)', padding: 4, minWidth: 130,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    }}
                  >
                    {onEdit && (
                      <MenuItem icon={<Pencil size={11} />} label="Editar" onClick={() => { setMenuOpen(false); onEdit() }} />
                    )}
                    {onExport && (
                      <MenuItem icon={<Copy size={11} />} label="Exportar" onClick={() => { setMenuOpen(false); onExport() }} />
                    )}
                    {onDelete && (
                      <MenuItem icon={<Trash2 size={11} />} label="Eliminar" onClick={() => { setMenuOpen(false); setConfirmDeleteOpen(true) }} danger />
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: expanded ? undefined : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {skill.description}
        </p>
        {skill.description.length > 80 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none', border: 'none', padding: 0, marginTop: 4,
              fontSize: 10, color: 'var(--accent)', cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {expanded ? 'Ver menos' : 'Ver más'}
          </button>
        )}

        {isDownloadableSkill && downloadable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 6 }}>
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= 4
              return (
                <Star
                  key={star}
                  size={9}
                  strokeWidth={1.5}
                  style={{ color: filled ? 'var(--status-warn)' : 'var(--border-strong)' }}
                  fill={filled ? 'var(--status-warn)' : 'none'}
                />
              )
            })}
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginLeft: 4 }}>
              ({downloadable.featured ? 'Destacado' : 'Popular'})
            </span>
          </div>
        )}

        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            {tags.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 9,
                  padding: '1px 6px',
                  borderRadius: 3,
                  background: 'var(--bg-active)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {(skill.category || skill.source) && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {skill.category && (
              <span
                style={{
                  fontSize: 8.5,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: 'var(--accent-muted)',
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-ui)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {skill.category}
              </span>
            )}
            {skill.source && skill.source !== 'builtin' && (
              <span
                style={{
                  fontSize: 8.5,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: 'var(--bg-active)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {skill.source}
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 6, alignItems: 'center' }}>
        {isDownloadableSkill ? (
          isInstalled ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--status-ok)', fontFamily: 'var(--font-ui)' }}>
              <Check size={11} strokeWidth={2} />
              Instalada
            </div>
          ) : (
            <button
              onClick={onInstall}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', background: 'var(--accent)', border: 'none',
                borderRadius: 'var(--radius-sm)', color: 'white', fontSize: 10.5,
                fontFamily: 'var(--font-ui)', cursor: 'pointer',
              }}
            >
              <Download size={10} strokeWidth={2} />
              Instalar
            </button>
          )
        ) : (
          <SkillToggle
            active={isActive}
            onChange={() => handleActivate()}
            size={28}
            ariaLabel={`${isActive ? 'Desactivar' : 'Activar'} skill ${skill.name}`}
          />
        )}
      </div>

      {onDelete && (
        <ConfirmDeleteDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          itemLabel={skill.name}
          onConfirm={onDelete}
        />
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '5px 10px', background: 'none', border: 'none',
        borderRadius: 'var(--radius-sm)', color: danger ? 'var(--status-err)' : 'var(--text-primary)',
        fontSize: 11, fontFamily: 'var(--font-ui)', cursor: 'pointer', textAlign: 'left',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
    >
      {icon}
      {label}
    </button>
  )
}
