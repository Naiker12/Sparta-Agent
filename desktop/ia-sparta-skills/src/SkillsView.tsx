import { cn } from 'ia-sparta-design-system'
import { useState, useMemo, useEffect } from 'react'
import { Search, Layers, Compass, Plus } from 'lucide-react'
import { useSkillStore } from 'ia-sparta-core'
import { useLocalSkillsLoader } from 'ia-sparta-core'
import { SkillCard } from './SkillCard'
import { SkillToggle } from './SkillToggle'
import { SkillCreator } from './SkillCreator'
import { SkillDialog } from './SkillDialog'
import type { Skill } from 'ia-sparta-core'

type Tab = 'mine' | 'explore' | 'create'

const CATEGORY_ICONS: Record<string, string> = {
  'Analysis': '\ud83d\udcca', 'Apple': '\ud83c\udf4e', 'Automation': '\u26a1',
  'Autonomous AI Agents': '\ud83e\udd16', 'Coding': '\ud83d\udcbb',
  'Creative': '\ud83c\udfa8', 'Data Science': '\ud83d\udd2c', 'Email': '\ud83d\udce7',
  'GitHub': '\ud83d\udc19', 'Media': '\ud83c\udfac', 'MLOps': '\ud83e\udde0',
  'Note Taking': '\ud83d\udcdd', 'Productivity': '\ud83d\udcc2',
  'Research': '\ud83d\udd0d', 'Smart Home': '\ud83c\udfe0',
  'Social Media': '\ud83d\udcf1', 'Software Development': '\ud83d\udee0\ufe0f',
  'Writing': '\u270d\ufe0f',
}

function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? CATEGORY_ICONS[category.replace(/-/g, ' ')] ?? '\ud83d\udce6'
}

function CategorySection({ category, count, activeCount, children }: { category: string; count: number; activeCount?: number; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-2 pt-3">
        <span className="text-xs">{getCategoryIcon(category)}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
          {category}
        </span>
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
          {count}
        </span>
        {activeCount !== undefined && activeCount > 0 && (
          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-mono">
            {activeCount} activas
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function ExploreSkillCard({ skill, isActive, onToggle }: {
  skill: { id: string; name: string; description: string; icon: string; tags: string[]; author?: string; version?: string }
  isActive: boolean
  onToggle: () => void
}) {
  return (
    <div className={cn(
      "bg-card/70 border border-border/60 rounded-lg p-3 border-l-4 transition-all duration-150",
      isActive ? "border-l-primary" : "border-l-transparent"
    )}>
      <div className="flex items-start gap-2 mb-1">
        <span className="text-base shrink-0">{skill.icon || '📦'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-foreground">
            {skill.name}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {skill.author || 'Sparta Team'} {skill.version ? `· v${skill.version}` : ''}
          </div>
        </div>
        <SkillToggle
          active={isActive}
          onChange={() => onToggle()}
          size={28}
          ariaLabel={`${isActive ? 'Desactivar' : 'Activar'} ${skill.name}`}
        />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed my-1.5">
        {skill.description}
      </p>
      {skill.tags?.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {skill.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[9.5px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center flex-col gap-2 py-12 px-6 text-muted-foreground">
      <Layers size={28} strokeWidth={1} />
      <span className="text-xs">{message}</span>
    </div>
  )
}

function SkeletonLoader() {
  return (
    <div className="flex flex-col gap-4 pt-3">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div className="w-20 h-2.5 bg-muted rounded mb-2 animate-pulse" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-20 bg-muted/60 rounded-md animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkillsView() {
  const { skills: userSkills, activeSkillIds, toggleActive, addSkill, updateSkill, deleteSkill, loadInstalledSkills } = useSkillStore()
  const { skills: localSkills, byCategory, loading } = useLocalSkillsLoader()
  const [tab, setTab] = useState<Tab>('mine')
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    loadInstalledSkills()
  }, [loadInstalledSkills])

  const mySkills = useMemo(() => {
    const builtins = localSkills.filter((s) => s.source === 'builtin')
    const userIds = new Set(userSkills.map((s) => s.id))
    return [
      ...userSkills,
      ...builtins.filter((s) => !userIds.has(s.id)).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        prompt: s.description,
        tags: s.tags as string[],
        category: s.category,
        icon: s.icon,
        version: s.version,
        author: s.author,
        source: s.source as Skill['source'],
        featured: s.featured,
        createdAt: Date.now(),
      } as Skill)),
    ]
  }, [userSkills, localSkills])

  const allTags = useMemo(
    () => [...new Set(mySkills.flatMap((s) => s.tags ?? []))].sort(),
    [mySkills]
  )

  const filteredMine = useMemo(() => {
    return mySkills.filter((s) => {
      if (activeTag && !(s.tags ?? []).includes(activeTag)) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      }
      return true
    })
  }, [mySkills, search, activeTag])

  const mineByCategory = useMemo(() => {
    return filteredMine.reduce<Record<string, typeof filteredMine>>((acc, s) => {
      const cat = (s.category as string) || 'General'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(s)
      return acc
    }, {})
  }, [filteredMine])

  const filteredExplore = useMemo(() => {
    if (!search.trim() && !activeTag) return byCategory
    return Object.entries(byCategory).reduce<Record<string, typeof localSkills>>((acc, [cat, skills]) => {
      const filtered = skills.filter((s) => {
        if (activeTag && !s.tags.includes(activeTag)) return false
        if (search.trim()) {
          const q = search.toLowerCase()
          return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
        }
        return true
      })
      if (filtered.length > 0) acc[cat] = filtered
      return acc
    }, {})
  }, [byCategory, search, activeTag])

  const exploreTags = useMemo(
    () => [...new Set(localSkills.flatMap((s) => s.tags))].sort(),
    [localSkills]
  )

  const totalActive = activeSkillIds.length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Skills</h2>
          <span style={{
            fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-active)',
            padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-mono)',
          }}>
            {mySkills.length}
          </span>
          {totalActive > 0 && (
            <span style={{
              fontSize: 10, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
              padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-mono)',
            }}>
              {totalActive} activas
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 16px', flexShrink: 0 }}>
        {([
          { key: 'mine' as Tab, label: 'Mis Skills', icon: <Layers size={11} /> },
          { key: 'explore' as Tab, label: 'Explorar', icon: <Compass size={11} /> },
          { key: 'create' as Tab, label: 'Crear', icon: <Plus size={11} /> },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '8px 16px', background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 500, cursor: 'pointer',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab !== 'create' && (
        <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)', padding: '6px 10px', marginBottom: 8,
          }}>
            <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'mine' ? 'Buscar en mis skills...' : 'Buscar skills...'}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-ui)',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingBottom: 8 }}>
            {(tab === 'mine' ? allTags : exploreTags).slice(0, 20).map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 3,
                  border: `1px solid ${activeTag === tag ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  background: activeTag === tag ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                  color: activeTag === tag ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'var(--font-ui)',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 20px' }}>
        {tab === 'mine' && (
          <>
            {filteredMine.length === 0 ? (
              <EmptyState message="No hay skills instaladas a\u00fan. Explora el cat\u00e1logo para agregar." />
            ) : (
              Object.entries(mineByCategory).map(([cat, catSkills]) => (
                <CategorySection key={cat} category={cat} count={catSkills.length}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                    {catSkills.map((skill) => (
                      <SkillCard
                        key={skill.id}
                        skill={skill}
                        onActivate={() => toggleActive(skill.id)}
                        onEdit={() => { setEditId(skill.id); setDialogOpen(true) }}
                        onDelete={() => deleteSkill(skill.id)}
                        onExport={() => {
                          const blob = new Blob([JSON.stringify(skill, null, 2)], { type: 'application/json' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url; a.download = `${skill.id}.skill.md`; a.click()
                          URL.revokeObjectURL(url)
                        }}
                      />
                    ))}
                  </div>
                </CategorySection>
              ))
            )}
          </>
        )}

        {tab === 'explore' && (
          <>
            {loading ? (
              <SkeletonLoader />
            ) : Object.keys(filteredExplore).length === 0 ? (
              <EmptyState message="No se encontraron skills con ese filtro." />
            ) : (
              Object.entries(filteredExplore).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catSkills]) => (
                <CategorySection
                  key={cat}
                  category={cat}
                  count={catSkills.length}
                  activeCount={catSkills.filter((s) => activeSkillIds.includes(s.id)).length}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                    {catSkills.map((skill) => (
                      <ExploreSkillCard
                        key={skill.id}
                        skill={skill}
                        isActive={activeSkillIds.includes(skill.id)}
                        onToggle={() => toggleActive(skill.id)}
                      />
                    ))}
                  </div>
                </CategorySection>
              ))
            )}
            {!loading && (
              <div style={{ padding: '12px 4px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                {localSkills.length} skills disponibles &middot; {activeSkillIds.length} instaladas
              </div>
            )}
          </>
        )}

        {tab === 'create' && <SkillCreator />}
      </div>

      {dialogOpen && editId && (
        <SkillDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditId(null) }}
          onSubmit={(n, d, p, t, c) => {
            if (editId) {
              updateSkill(editId, { name: n, description: d, prompt: p, tags: t, category: c as any })
            } else {
              addSkill(n, d, p, t, c)
            }
            setDialogOpen(false)
            setEditId(null)
          }}
          onDelete={editId ? () => { deleteSkill(editId); setDialogOpen(false); setEditId(null) } : undefined}
          initial={editId ? userSkills.find(s => s.id === editId) ?? null : null}
        />
      )}
    </div>
  )
}
