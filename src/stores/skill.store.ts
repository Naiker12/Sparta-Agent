import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Skill } from '@/types'
import { useEventBus } from './event-bus.store'

interface SkillState {
  skills: Skill[]
  addSkill: (name: string, description: string, prompt: string, tags?: string[]) => string
  updateSkill: (id: string, partial: Partial<Skill>) => void
  deleteSkill: (id: string) => void
}

const defaultSkills: Skill[] = [
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Revisa código y sugiere mejoras',
    prompt: 'Revisa el siguiente código y sugiere mejoras de calidad, seguridad y rendimiento.',
    icon: '\u26A1',
    tags: ['code', 'review'],
    createdAt: Date.now(),
  },
  {
    id: 'doc-summary',
    name: 'Resumen de docs',
    description: 'Genera un resumen conciso de documentación',
    prompt: 'Genera un resumen ejecutivo del siguiente documento en 3-5 párrafos.',
    icon: '\u26A1',
    tags: ['docs', 'summary'],
    createdAt: Date.now(),
  },
]

export const useSkillStore = create<SkillState>()(
  persist(
    (set) => ({
  skills: defaultSkills,

  addSkill: (name, description, prompt, tags) => {
    const id = crypto.randomUUID()
    const skill: Skill = { id, name, description, prompt, tags, createdAt: Date.now() }
    set((s) => ({ skills: [...s.skills, skill] }))
    useEventBus.getState().dispatch({ type: 'skill:created', skillId: id, timestamp: Date.now() })
    return id
  },

  updateSkill: (id, partial) => {
    set((s) => ({
      skills: s.skills.map((sk) => (sk.id === id ? { ...sk, ...partial } : sk)),
    }))
    useEventBus.getState().dispatch({ type: 'skill:updated', skillId: id, timestamp: Date.now() })
  },

  deleteSkill: (id) => {
    set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) }))
    useEventBus.getState().dispatch({ type: 'skill:deleted', skillId: id, timestamp: Date.now() })
  },
}),
    { name: 'sparta-skills' }
  )
)
