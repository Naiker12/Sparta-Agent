import { cn } from 'ia-sparta-design-system'
import { useState, useMemo, useEffect } from 'react'
import { Search, Layers, Plus } from 'lucide-react'
import { useSkillStore } from 'ia-sparta-core'
import { useLocalSkillsLoader } from 'ia-sparta-core'
import { SkillCard } from './SkillCard'
import { SkillToggle } from './SkillToggle'
import { SkillCreator } from './SkillCreator'
import { SkillDialog } from './SkillDialog'
import type { Skill } from 'ia-sparta-core'

type Tab = 'mine' | 'explore' | 'create'

const CATEGORY_ICONS: Record<string, string> = {
  'Analysis': '📊', 'Apple': '🍎', 'Automation': '⚡',
  'Autonomous AI Agents': '🤖', 'Coding': '💻',
  'Creative': '🎨', 'Data Science': '🔬', 'Email': '📧',
  'GitHub': '🐙', 'Media': '🎬', 'MLOps': '🧠',
  'Note Taking': '📝', 'Productivity': '📂',
  'Research': '🔍', 'Smart Home': '🏠',
  'Social Media': '📱', 'Software Development': '🛠️',
  'Writing': '✍️',
}

function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? CATEGORY_ICONS[category.replace(/-/g, ' ')] ?? '📦'
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

export function SkillsView() {
  const { skills: userSkills, activeSkillIds, toggleActive, addSkill, updateSkill, deleteSkill, loadInstalledSkills } = useSkillStore()
  const { skills: localSkills, byCategory } = useLocalSkillsLoader()
  const [tab, setTab] = useState<Tab>('mine')
  const [search, setSearch] = useState('')
  const [editSkill, setEditSkill] = useState<Skill | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    loadInstalledSkills()
  }, [loadInstalledSkills])

  const mySkills: Skill[] = useMemo(() => {
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
        category: (s.category as any) || 'Productivity',
        icon: s.icon,
        version: s.version,
        author: s.author,
        source: s.source as Skill['source'],
        featured: s.featured,
        createdAt: Date.now(),
      })),
    ]
  }, [userSkills, localSkills])

  const filteredMine = useMemo(() => {
    let list = mySkills
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    }
    return list
  }, [mySkills, search])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-ui)', background: 'var(--bg-base)' }}>
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', borderBottom: '1px solid var(--border-normal)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            height: 30, width: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
            color: 'var(--accent)',
          }}>
            <Layers size={15} strokeWidth={1.8} />
          </div>
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>
              Catálogo de Skills
            </h2>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '3px 0 0', fontFamily: 'var(--font-mono)' }}>
              {activeSkillIds.length} activas · {mySkills.length} instaladas
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTab('create')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
            borderRadius: 6, background: 'var(--accent)', color: 'white', border: 'none',
            fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)', cursor: 'pointer',
          }}
        >
          <Plus size={12} strokeWidth={2.5} />
          <span>Nueva Skill</span>
        </button>
      </div>

      {/* ── Controls Bar ─────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 20px', borderBottom: '1px solid var(--border-normal)', background: 'var(--bg-surface)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => setTab('mine')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 11,
              fontWeight: tab === 'mine' ? 600 : 400,
              color: tab === 'mine' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: tab === 'mine' ? '2px solid var(--accent)' : '2px solid transparent',
              paddingBottom: 4,
            }}
          >
            Mis Skills ({mySkills.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('explore')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 11,
              fontWeight: tab === 'explore' ? 600 : 400,
              color: tab === 'explore' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: tab === 'explore' ? '2px solid var(--accent)' : '2px solid transparent',
              paddingBottom: 4,
            }}
          >
            Explorar ({localSkills.length})
          </button>
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={12} style={{ position: 'absolute', left: 8, color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            style={{
              padding: '3px 8px 3px 26px', fontSize: 11, borderRadius: 6,
              background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', outline: 'none', width: 160,
            }}
          />
        </div>
      </div>

      {/* ── Content Grid ─────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {tab === 'mine' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filteredMine.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                installed
                onActivate={() => toggleActive(skill.id)}
                onEdit={() => { setEditSkill(skill); setDialogOpen(true) }}
                onDelete={() => deleteSkill(skill.id)}
              />
            ))}
          </div>
        )}

        {tab === 'explore' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(byCategory).map(([cat, items]) => (
              <CategorySection key={cat} category={cat} count={items.length}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {items.map((item) => (
                    <ExploreSkillCard
                      key={item.id}
                      skill={item}
                      isActive={activeSkillIds.includes(item.id)}
                      onToggle={() => toggleActive(item.id)}
                    />
                  ))}
                </div>
              </CategorySection>
            ))}
          </div>
        )}

        {tab === 'create' && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <SkillCreator />
          </div>
        )}
      </div>

      {dialogOpen && (
        <SkillDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditSkill(null) }}
          initial={editSkill}
          onSubmit={(name, description, prompt, tags, category) => {
            if (editSkill) {
              updateSkill(editSkill.id, { name, description, prompt, tags, category })
            } else {
              addSkill(name, description, prompt, tags, category)
            }
            setDialogOpen(false)
            setEditSkill(null)
          }}
        />
      )}
    </div>
  )
}
