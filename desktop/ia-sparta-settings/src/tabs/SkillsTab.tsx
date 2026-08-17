import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { useSkillStore, useLocalSkillsLoader } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import { SkillDialog } from 'ia-sparta-skills'
import { Switch, ConfirmDeleteDialog, SkillCategoryIcon, cn } from 'ia-sparta-design-system'

function normalizeCategoryName(raw: string): string {
  if (!raw) return 'General'
  const trimmed = raw.trim().toLowerCase()
  if (trimmed === 'all' || trimmed === 'todas') return 'Todas'
  if (trimmed === 'coding' || trimmed === 'code' || trimmed === 'software development') return 'Coding'
  if (trimmed === 'sistema' || trimmed === 'builtin' || trimmed === 'system') return 'Sistema'
  if (trimmed === 'research' || trimmed === 'investigacion' || trimmed === 'analysis') return 'Research'
  if (trimmed === 'productivity' || trimmed === 'productividad' || trimmed === 'automation') return 'Productivity'
  if (trimmed === 'creative' || trimmed === 'creativo' || trimmed === 'media') return 'Creative'
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

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
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas')

  const allSkills: SkillDisplay[] = useMemo(() => {
    const userIds = new Set(userSkills.map((s) => s.id))
    const mapped: SkillDisplay[] = [
      ...userSkills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        icon: (s as any).icon || '',
        category: normalizeCategoryName((s as any).category || 'Coding'),
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
          category: normalizeCategoryName(s.category || 'Sistema'),
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
    const primary = ['Todas', 'Coding', 'Sistema', 'Research', 'Productivity', 'Creative']
    const existing = new Set(allSkills.map((s) => s.category))
    return primary.filter((c) => c === 'Todas' || existing.has(c))
  }, [allSkills])

  const filtered = useMemo(() => {
    return allSkills.filter((s) => {
      const matchCat = selectedCategory === 'Todas' || s.category.toLowerCase() === selectedCategory.toLowerCase()
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
    <div className="flex flex-col gap-5 py-2">

      {/* ── Header row ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {t('skills.title') || 'Skills'}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {activeCount} activas de {allSkills.length} disponibles
          </p>
        </div>
        <button
          onClick={() => { setEditId(null); setDialogOpen(true) }}
          className="flex items-center gap-2 rounded-xl font-semibold text-sm transition-all cursor-pointer active:scale-[0.98] shrink-0"
          style={{ background: 'var(--accent)', color: '#fff', padding: '9px 18px', border: 'none', fontFamily: 'var(--font-ui)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
        >
          <Plus className="size-icon-sm" strokeWidth={2.5} />
          <span>{t('skills.create') || 'Nueva skill'}</span>
        </button>
      </div>


      {/* ── Category Pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="text-sm rounded-full transition-all cursor-pointer"
              style={{
                padding: '7px 18px',
                background: isSelected ? 'var(--accent)' : 'var(--bg-surface)',
                color: isSelected ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                fontWeight: isSelected ? 600 : 400,
                fontFamily: 'var(--font-ui)',
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-active)' }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface)' }}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* ── Search Bar ── */}
      <div style={{ position: 'relative' }}>
        <Search
          className="size-icon-sm pointer-events-none"
          style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar skills por nombre, categoria o etiqueta..."
          className="w-full text-sm rounded-2xl transition-all"
          style={{
            padding: '11px 16px 11px 40px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: 'var(--font-ui)',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none' }}
        />
      </div>

      {/* ── Skills List ── */}
      <div className="flex flex-col gap-2">
        {filtered.map((skill) => {
          const isEnabled = activeSkillIds.includes(skill.id) || !skill.editable
          const isSystem = !skill.editable

          return (
            <div
              key={skill.id}
              className={cn('rounded-2xl p-card-lg flex items-center justify-between gap-5 transition-all', !isEnabled && 'opacity-55')}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)' }}
            >
              {/* Icon box */}
              <div
                className="size-icon-box rounded-2xl flex items-center justify-center border shrink-0"
                style={{
                  background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
                }}
              >
                <SkillCategoryIcon
                  category={skill.category}
                  size={22}
                  strokeWidth={1.8}
                  className=""
                />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {skill.name}
                  </h3>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium lowercase"
                    style={{ background: 'var(--bg-active)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                  >
                    {skill.category.toLowerCase()}
                  </span>
                  {isSystem && (
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                        color: 'var(--accent)',
                        border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
                      }}
                    >
                      sistema
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5 line-clamp-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {skill.description}
                </p>
              </div>

              {/* Actions + Switch */}
              <div className="flex items-center gap-2 shrink-0">
                {skill.editable && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => { setEditId(skill.id); setDialogOpen(true) }}
                      title={t('skills.edit') || 'Editar'}
                      className="p-2 rounded-lg transition-colors cursor-pointer"
                      style={{ color: 'var(--text-muted)', background: 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-active)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                    >
                      <Pencil className="size-icon-sm" strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => setSkillToDelete(skill.id)}
                      title={t('skills.delete') || 'Eliminar'}
                      className="p-2 rounded-lg transition-colors cursor-pointer"
                      style={{ color: 'var(--text-muted)', background: 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-active)'; e.currentTarget.style.color = 'var(--status-err)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                    >
                      <Trash2 className="size-icon-sm" strokeWidth={1.75} />
                    </button>
                  </div>
                )}
                <Switch
                  checked={isEnabled}
                  disabled={!skill.editable}
                  onCheckedChange={skill.editable ? () => toggleActive(skill.id) : undefined}
                />
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            {search ? 'No se encontraron skills con ese filtro.' : 'No hay skills disponibles.'}
          </div>
        )}
      </div>

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
        title={t('skills.delete') || 'Eliminar habilidad'}
        itemLabel={skillToDeleteName}
        onConfirm={() => {
          if (skillToDelete) deleteSkill(skillToDelete)
          setSkillToDelete(null)
        }}
      />
    </div>
  )
}
