import { useState, useMemo, useEffect } from 'react'
import { Search, Layers, Plus, Sparkles, Globe, Zap } from 'lucide-react'
import { useSkillStore } from 'ia-sparta-core'
import { useLocalSkillsLoader } from 'ia-sparta-core'
import { SkillCard } from './SkillCard'
import { SkillCreator } from './SkillCreator'
import { SkillDialog } from './SkillDialog'
import { SkillMarkdownDialog } from './SkillMarkdownDialog'
import type { Skill, InstalledSkill } from 'ia-sparta-core'
import { Button, SkillCategoryIcon } from 'ia-sparta-design-system'

type Tab = 'mine' | 'explore' | 'create'

function StatPill({ label, value, accent = false, icon }: { label: string; value: number; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
      {icon}
      <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
      <span style={{ fontWeight: 600, color: accent ? 'var(--status-ok)' : 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  )
}

function CategorySection({ category, count, activeCount, children }: { category: string; count: number; activeCount?: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingTop: 4 }}>
        <SkillCategoryIcon category={category} size={15} strokeWidth={2} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {category}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', background: 'var(--bg-active)', color: 'var(--text-muted)' }}>
          {count}
        </span>
        {activeCount !== undefined && activeCount > 0 && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
            {activeCount} activas
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function ExploreSkillCard({ skill, isActive, onToggle, onOpen }: {
  skill: { id: string; name: string; description: string; icon: string; tags: string[]; author?: string; version?: string; category?: string }
  isActive: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
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
        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        boxShadow: hovered ? '0 18px 40px rgba(0,0,0,0.08)' : '0 10px 25px rgba(0,0,0,0.05)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 14,
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
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
            <span style={{ fontSize: 14, lineHeight: 1 }}>{skill.icon || '⚡'}</span>
          )}
        </div>

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

          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
            {skill.author || 'Sparta Team'} {skill.version ? `· v${skill.version}` : ''}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle() }}
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
      </div>

      <p
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          margin: 0,
          lineHeight: 1.45,
          fontFamily: 'var(--font-ui)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {skill.description}
      </p>

      {skill.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
          {skill.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
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
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function SkillsView() {
  const { skills: userSkills, installedSkills, activeSkillIds, toggleActive, addSkill, updateSkill, deleteSkill, loadInstalledSkills } = useSkillStore()
  const { skills: localSkills } = useLocalSkillsLoader()
  const [tab, setTab] = useState<Tab>('mine')
  const [search, setSearch] = useState('')
  const [editSkill, setEditSkill] = useState<Skill | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [previewSkill, setPreviewSkill] = useState<Skill | InstalledSkill | null>(null)

  useEffect(() => {
    void loadInstalledSkills()
  }, [loadInstalledSkills])

  const catalogSkills = installedSkills.length > 0 ? installedSkills : localSkills
  const byCategory = useMemo(() => catalogSkills.reduce<Record<string, InstalledSkill[]>>((groups, skill) => {
    const category = skill.category || 'Other'
    if (!groups[category]) groups[category] = []
    groups[category].push(skill as InstalledSkill)
    return groups
  }, {}), [catalogSkills])

  const mySkills: Skill[] = useMemo(() => {
    const builtins = catalogSkills.filter((s) => s.source === 'builtin')
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
  }, [userSkills, catalogSkills])

  const filteredMine = useMemo(() => {
    let list = mySkills
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    }
    return list
  }, [mySkills, search])

  const categoriesCount = Object.keys(byCategory).length
  const activeCount = activeSkillIds.length

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'mine', label: 'Mis Skills', icon: <Sparkles size={12} strokeWidth={1.8} />, count: mySkills.length },
    { key: 'explore', label: 'Explorar', icon: <Globe size={12} strokeWidth={1.8} />, count: catalogSkills.length },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-ui)', background: 'var(--bg-base)' }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid var(--border-normal)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              height: 30,
              width: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
              color: 'var(--accent)',
            }}
          >
            <Layers size={14} strokeWidth={1.8} />
          </div>
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>
              Catálogo de Skills
            </h2>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '3px 0 0', fontFamily: 'var(--font-mono)' }}>
              {activeCount}/{mySkills.length} activas · {categoriesCount} categorías
            </p>
          </div>
        </div>

        <Button
          onClick={() => { setEditSkill(null); setDialogOpen(true) }}
          size="sm"
          style={{ fontSize: 11, fontWeight: 600, height: 30, gap: 6 }}
        >
          <Plus size={12} strokeWidth={2.5} />
          Nueva Skill
        </Button>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '6px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <StatPill label="Activas" value={activeCount} accent />
        <div style={{ width: 1, height: 12, background: 'var(--border-normal)' }} />
        <StatPill label="Instaladas" value={mySkills.length} />
        <div style={{ width: 1, height: 12, background: 'var(--border-normal)' }} />
        <StatPill label="Categorías" value={categoriesCount} icon={<Zap size={10} style={{ color: 'var(--status-warn)' }} />} />
      </div>

      {/* ── Tabs & Search ───────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          borderBottom: '1px solid var(--border-normal)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          {TABS.map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '8px 12px',
                fontSize: 11,
                fontWeight: tab === tabItem.key ? 600 : 500,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                border: 'none',
                background: 'transparent',
                borderBottom: `2px solid ${tab === tabItem.key ? 'var(--accent)' : 'transparent'}`,
                color: tab === tabItem.key ? 'var(--accent)' : 'var(--text-secondary)',
                transition: 'all 0.15s',
                marginBottom: -1,
                outline: 'none',
              }}
            >
              {tabItem.icon}
              {tabItem.label}
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 10,
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.4,
                  background: tab === tabItem.key ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--bg-active)',
                  color: tab === tabItem.key ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {tabItem.count}
              </span>
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={12} style={{ position: 'absolute', left: 8, color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            style={{
              padding: '4px 8px 4px 26px',
              fontSize: 11,
              borderRadius: 6,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              outline: 'none',
              width: 180,
              fontFamily: 'var(--font-ui)',
            }}
          />
        </div>
      </div>

      {/* ── Content Grid ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {tab === 'mine' && (
          filteredMine.length === 0 ? (
            <EmptyState label="No tienes skills instaladas todavía." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {filteredMine.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  installed
                  onActivate={() => toggleActive(skill.id)}
                  onEdit={() => { setEditSkill(skill); setDialogOpen(true) }}
                  onDelete={() => deleteSkill(skill.id)}
                  onOpen={() => setPreviewSkill(skill)}
                />
              ))}
            </div>
          )
        )}

        {tab === 'explore' && (
          <div>
            {Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => {
              const matchingItems = search.trim()
                ? items.filter((item) => `${item.name} ${item.description} ${item.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()))
                : items
              if (matchingItems.length === 0) return null
              return (
                <CategorySection key={cat} category={cat} count={matchingItems.length} activeCount={matchingItems.filter((item) => activeSkillIds.includes(item.id)).length}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                    {matchingItems.map((item) => (
                      <ExploreSkillCard
                        key={item.id}
                        skill={item}
                        isActive={activeSkillIds.includes(item.id)}
                        onToggle={() => toggleActive(item.id)}
                        onOpen={() => setPreviewSkill(item)}
                      />
                    ))}
                  </div>
                </CategorySection>
              )
            })}
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
      <SkillMarkdownDialog
        open={previewSkill !== null}
        skill={previewSkill}
        onClose={() => setPreviewSkill(null)}
        trustLevel={previewSkill && 'trustLevel' in previewSkill ? previewSkill.trustLevel : undefined}
      />
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: 8 }}>
      <Layers size={24} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{label}</p>
    </div>
  )
}