import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { useSkillStore } from 'ia-sparta-core'
import { useLocalSkillsLoader } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import { SettingGroup } from './primitives'
import { SkillDialog } from 'ia-sparta-skills'
import { ConfirmDeleteDialog, SkillCategoryIcon } from 'ia-sparta-design-system'

interface SkillDisplay {
  id: string
  name: string
  description: string
  icon: string
  category: string
  tags: string[]
  source: string
  editable: boolean
}

export function SkillsTab() {
  const { skills: userSkills, activeSkillIds, toggleActive, addSkill, updateSkill, deleteSkill } = useSkillStore()
  const { skills: localSkills } = useLocalSkillsLoader()
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [skillToDelete, setSkillToDelete] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const allSkills: SkillDisplay[] = useMemo(() => {
    const userIds = new Set(userSkills.map((s) => s.id))
    const mapped: SkillDisplay[] = [
      ...userSkills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        icon: (s as any).icon || '',
        category: (s as any).category || 'Coding',
        tags: s.tags ?? [],
        source: 'user',
        editable: true,
      })),
      ...localSkills
        .filter((s) => !userIds.has(s.id))
        .map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          icon: s.icon,
          category: s.category || 'Sistema',
          tags: s.tags || [],
          source: s.source || 'builtin',
          editable: false,
        })),
    ]
    return mapped.sort((a, b) => {
      if (a.editable !== b.editable) return a.editable ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [userSkills, localSkills])

  const categories = useMemo(() => {
    const cats = new Set(allSkills.map((s) => s.category).filter(Boolean))
    return ['all', ...Array.from(cats)]
  }, [allSkills])

  const filtered = useMemo(() => {
    return allSkills.filter((s) => {
      const matchCat = selectedCategory === 'all' || s.category.toLowerCase() === selectedCategory.toLowerCase()
      if (!matchCat) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [allSkills, search, selectedCategory])

  const activeCount = useMemo(() => {
    return allSkills.filter((s) => activeSkillIds.includes(s.id) || !s.editable).length
  }, [allSkills, activeSkillIds])

  const skillToDeleteName = allSkills.find((s) => s.id === skillToDelete)?.name ?? ''

  function handleSubmit(name: string, description: string, prompt: string, tags: string[], category: string) {
    if (editId) {
      updateSkill(editId, { name, description, prompt, tags, category: category as any })
    } else {
      addSkill(name, description, prompt, tags, category)
    }
    setDialogOpen(false)
    setEditId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SettingGroup
        title={t('skills.title') || 'Skills'}
        description={t('skills.desc') || 'Capacidades reutilizables que los agentes pueden invocar.'}
      >
        {/* Sub-header counter badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              Total: {allSkills.length} skills
            </span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(16,185,129,0.12)', color: 'var(--status-ok, #10b981)', fontWeight: 600 }}>
              {activeCount} Activas
            </span>
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat
            const label = cat === 'all' ? 'Todas' : cat
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 14,
                  fontSize: 10.5,
                  fontWeight: isSelected ? 600 : 400,
                  background: isSelected ? 'var(--accent)' : 'var(--bg-input)',
                  color: isSelected ? '#ffffff' : 'var(--text-muted)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar skills por nombre, categoría o etiqueta..."
            style={{
              width: '100%',
              padding: '7px 10px 7px 30px',
              fontSize: 12,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
              outline: 'none',
            }}
          />
        </div>

        {/* Skills Cards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((skill) => {
            const isEnabled = activeSkillIds.includes(skill.id) || !skill.editable

            return (
              <div
                key={skill.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: 'var(--bg-input)',
                  border: `1px solid ${isEnabled ? 'var(--border-normal)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  opacity: isEnabled ? 1 : 0.65,
                  transition: 'all 0.12s ease',
                }}
              >
                {/* SVG / Lucide Category Icon */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                  <SkillCategoryIcon category={skill.category} size={16} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
                      {skill.name}
                    </span>

                    <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', background: 'var(--bg-active)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
                      {skill.category}
                    </span>

                    {!skill.editable && (
                      <span style={{ fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent)', background: 'rgba(99,102,241,0.12)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>
                        SISTEMA
                      </span>
                    )}

                    {isEnabled && (
                      <span style={{ fontSize: 8.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--status-ok, #10b981)', background: 'rgba(16,185,129,0.12)', padding: '1px 6px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--status-ok, #10b981)' }} />
                        ACTIVA
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: 3, lineHeight: 1.4 }}>
                    {skill.description}
                  </div>

                  {skill.tags && skill.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {skill.tags.map((tag) => (
                        <span key={tag} style={{ fontSize: 9.5, color: 'var(--text-muted)', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Toggle & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => toggleActive(skill.id)}
                    title={isEnabled ? 'Desactivar skill' : 'Activar skill'}
                    style={{
                      width: 30,
                      height: 16,
                      borderRadius: 8,
                      background: isEnabled ? 'var(--status-ok, #10b981)' : 'var(--border-normal)',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: 2,
                        left: isEnabled ? 16 : 2,
                        transition: 'left 0.15s',
                      }}
                    />
                  </button>

                  {skill.editable && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        onClick={() => { setEditId(skill.id); setDialogOpen(true) }}
                        title={t('skills.edit')}
                        style={{
                          width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.12s',
                        }}
                      >
                        <Pencil size={11} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => setSkillToDelete(skill.id)}
                        title={t('skills.delete')}
                        style={{
                          width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.12s',
                        }}
                      >
                        <Trash2 size={11} strokeWidth={1.5} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              {search ? 'No se encontraron skills con ese filtro.' : 'No hay skills disponibles.'}
            </div>
          )}
        </div>

        <button
          onClick={() => { setEditId(null); setDialogOpen(true) }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', marginTop: 8,
            background: 'none', border: '1px dashed var(--border-normal)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-muted)',
            fontSize: 11.5, fontFamily: 'var(--font-ui)', cursor: 'pointer',
            transition: 'all 0.12s', width: '100%',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-normal)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <Plus size={13} strokeWidth={1.5} />
          {t('skills.create') || 'Crear skill'}
        </button>
      </SettingGroup>

      <SkillDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditId(null) }}
        onSubmit={handleSubmit}
        onDelete={editId ? () => { deleteSkill(editId); setDialogOpen(false); setEditId(null) } : undefined}
        initial={editId ? userSkills.find((s) => s.id === editId) ?? null : null}
      />

      <ConfirmDeleteDialog
        open={skillToDelete !== null}
        onOpenChange={(open) => !open && setSkillToDelete(null)}
        title={t('skills.delete')}
        itemLabel={skillToDeleteName}
        onConfirm={() => {
          if (skillToDelete) deleteSkill(skillToDelete)
          setSkillToDelete(null)
        }}
      />
    </div>
  )
}
