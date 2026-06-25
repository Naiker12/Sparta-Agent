import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useSkillStore } from '@/stores/skill.store'
import { SidebarSection } from './SidebarSection'
import { SkillDialog } from '@/components/skills/SkillDialog'
import { SkillItem } from './SkillItem'

export function SkillsSection() {
  const { skills, addSkill, deleteSkill } = useSkillStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  function handleSubmit(name: string, description: string, prompt: string, tags: string[]) {
    addSkill(name, description, prompt, tags)
    setDialogOpen(false)
    setEditId(null)
  }

  return (
    <>
      <SidebarSection
        title="Skills"
        count={skills.length}
        action={
          <button
            onClick={() => {
              setEditId(null)
              setDialogOpen(true)
            }}
            style={iconBtnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Agregar skill"
          >
            <Plus size={11} strokeWidth={2} />
          </button>
        }
      >
        {skills.length === 0 ? (
          <p
            style={{
              padding: '4px 14px 8px',
              fontSize: 11,
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}
          >
            Sin skills. Crea una para empezar.
          </p>
        ) : (
          skills.map((skill) => (
            <SkillItem
              key={skill.id}
              name={skill.name}
              description={skill.description}
              onClick={() => {
                setEditId(skill.id)
                setDialogOpen(true)
              }}
            />
          ))
        )}
      </SidebarSection>

      <SkillDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditId(null)
        }}
        onSubmit={handleSubmit}
        onDelete={
          editId
            ? () => {
                deleteSkill(editId)
                setDialogOpen(false)
                setEditId(null)
              }
            : undefined
        }
        initial={
          editId
            ? skills.find((s) => s.id === editId)
            : null
        }
      />
    </>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  transition: 'all 0.15s',
}
