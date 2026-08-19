import { useState, useMemo } from 'react'
import { useSkillStore, useLocalSkillsLoader } from 'ia-sparta-core'
import { SkillDialog } from 'ia-sparta-skills'
import { ConfirmDeleteDialog } from 'ia-sparta-design-system'
import { SkillsHeaderSection } from './skills/sections/SkillsHeaderSection'
import { SkillsGridSection, type SkillDisplayItem } from './skills/sections/SkillsGridSection'

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

export function SkillsTab() {
  const { skills: userSkills, activeSkillIds, toggleActive, addSkill, updateSkill, deleteSkill } = useSkillStore()
  const { skills: localSkills } = useLocalSkillsLoader()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [skillToDelete, setSkillToDelete] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas')

  const allSkills: SkillDisplayItem[] = useMemo(() => {
    const userIds = new Set(userSkills.map((s) => s.id))
    const mapped: SkillDisplayItem[] = [
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
          category: normalizeCategoryName(s.category),
          tags: s.tags,
          source: 'local',
          editable: false,
        })),
    ]
    return mapped
  }, [userSkills, localSkills])

  const categories = useMemo(() => {
    const set = new Set<string>(['Todas'])
    allSkills.forEach((s) => set.add(s.category))
    return Array.from(set)
  }, [allSkills])

  const filteredSkills = useMemo(() => {
    return allSkills.filter((s) => {
      const matchCat = selectedCategory === 'Todas' || s.category === selectedCategory
      const matchQuery =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      return matchCat && matchQuery
    })
  }, [allSkills, selectedCategory, search])

  const currentEditSkill = editId ? userSkills.find((s) => s.id === editId) : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. Header & Filtros */}
      <SkillsHeaderSection
        search={search}
        onSearchChange={setSearch}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onNewSkill={() => {
          setEditId(null)
          setDialogOpen(true)
        }}
      />

      {/* 2. Rejilla de Habilidades */}
      <SkillsGridSection
        skills={filteredSkills}
        activeSkillIds={activeSkillIds}
        onToggleActive={toggleActive}
        onEdit={(id) => {
          setEditId(id)
          setDialogOpen(true)
        }}
        onDelete={(id) => setSkillToDelete(id)}
      />

      {/* Dialogs */}
      {dialogOpen && (
        <SkillDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={(name, description, prompt, tags, category) => {
            if (editId) {
              updateSkill(editId, { name, description, prompt, tags, category: category as any })
            } else {
              addSkill(name, description, prompt, tags, category)
            }
            setDialogOpen(false)
          }}
          initial={currentEditSkill}
        />
      )}

      {skillToDelete && (
        <ConfirmDeleteDialog
          open={!!skillToDelete}
          onOpenChange={(open) => {
            if (!open) setSkillToDelete(null)
          }}
          itemLabel="esta habilidad"
          onConfirm={() => {
            if (skillToDelete) {
              deleteSkill(skillToDelete)
              setSkillToDelete(null)
            }
          }}
        />
      )}
    </div>
  )
}
