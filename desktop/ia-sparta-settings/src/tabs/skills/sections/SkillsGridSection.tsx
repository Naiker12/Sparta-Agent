import { Switch, SkillCategoryIcon } from 'ia-sparta-design-system'
import { Pencil, Trash2 } from 'lucide-react'

export interface SkillDisplayItem {
  id: string
  name: string
  description: string
  icon: string
  category: string
  tags: string[]
  source: string
  editable: boolean
}

interface SkillsGridProps {
  skills: SkillDisplayItem[]
  activeSkillIds: string[]
  onToggleActive: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function SkillsGridSection({
  skills,
  activeSkillIds,
  onToggleActive,
  onEdit,
  onDelete,
}: SkillsGridProps) {
  if (skills.length === 0) {
    return (
      <div
        style={{
          padding: '36px 16px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
          border: '1px dashed var(--border-subtle)',
          borderRadius: 'var(--radius-lg, 12px)',
          color: 'var(--text-muted)',
          fontSize: 12,
        }}
      >
        No se encontraron habilidades que coincidan con la búsqueda.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {skills.map((skill) => {
        const isActive = activeSkillIds.includes(skill.id)

        return (
          <div
            key={skill.id}
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg, 12px)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 12,
              transition: 'all 0.12s ease',
            }}
          >
            {/* Top row: Icon + Name + Switch */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SkillCategoryIcon category={skill.category} size={16} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {skill.name}
                  </h4>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    {skill.category}
                  </span>
                </div>
              </div>

              <Switch
                checked={isActive}
                onCheckedChange={() => onToggleActive(skill.id)}
              />
            </div>

            {/* Description */}
            <p
              style={{
                margin: 0,
                fontSize: 11.5,
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {skill.description || 'Sin descripción disponible.'}
            </p>

            {/* Tags & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {skill.tags.slice(0, 2).map((t, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: 9.5,
                      padding: '1px 5px',
                      borderRadius: 4,
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    #{t}
                  </span>
                ))}
              </div>

              {skill.editable && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => onEdit(skill.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                    title="Editar habilidad"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(skill.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                    title="Eliminar habilidad"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
