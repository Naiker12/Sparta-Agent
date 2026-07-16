import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Skill, InstalledSkill } from '../types'
import { useEventBus } from './event-bus.store'

const SKILLS_API = typeof window !== 'undefined' && (window as any).skills

interface SkillState {
  skills: Skill[]
  activeSkillIds: string[]
  installedSkills: InstalledSkill[]
  loading: boolean

  addSkill: (name: string, description: string, prompt: string, tags?: string[], category?: string) => string
  updateSkill: (id: string, partial: Partial<Skill>) => void
  deleteSkill: (id: string) => void
  toggleActive: (id: string) => void
  isActive: (id: string) => boolean

  loadInstalledSkills: () => Promise<void>
  installFromUrl: (url: string) => Promise<{ success: boolean; skillId?: string; error?: string }>
  uninstallSkill: (skillId: string) => Promise<{ success: boolean; error?: string }>
}

export const useSkillStore = create<SkillState>()(
  persist(
    (set, get) => ({
      skills: [],
      activeSkillIds: [],
      installedSkills: [],
      loading: false,

      addSkill: (name, description, prompt, tags, category) => {
        const id = crypto.randomUUID()
        const skill: Skill = { id, name, description, prompt, tags, category: category as any, createdAt: Date.now() }
        set((s) => ({
          skills: [...s.skills, skill],
          activeSkillIds: [...s.activeSkillIds, id],
        }))
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
        set((s) => ({
          skills: s.skills.filter((sk) => sk.id !== id),
          activeSkillIds: s.activeSkillIds.filter((aid) => aid !== id),
        }))
        useEventBus.getState().dispatch({ type: 'skill:deleted', skillId: id, timestamp: Date.now() })
      },

      toggleActive: (id) => {
        set((s) => ({
          activeSkillIds: s.activeSkillIds.includes(id)
            ? s.activeSkillIds.filter((aid) => aid !== id)
            : [...s.activeSkillIds, id],
        }))
      },

      isActive: (id) => get().activeSkillIds.includes(id),

      loadInstalledSkills: async () => {
        if (!SKILLS_API) return
        set({ loading: true })
        try {
          const list = await SKILLS_API.list()
          set({ installedSkills: list as InstalledSkill[], loading: false })
        } catch {
          set({ loading: false })
        }
      },

      installFromUrl: async (url) => {
        if (!SKILLS_API) return { success: false, error: 'Skills API not available' }
        const result = await SKILLS_API.installFromUrl(url)
        if (result.success) {
          await get().loadInstalledSkills()
        }
        return result
      },

      uninstallSkill: async (skillId) => {
        if (!SKILLS_API) return { success: false, error: 'Skills API not available' }
        const result = await SKILLS_API.uninstall(skillId)
        if (result.success) {
          set((s) => ({
            installedSkills: s.installedSkills.filter((sk) => sk.id !== skillId),
            activeSkillIds: s.activeSkillIds.filter((aid) => aid !== skillId),
          }))
        }
        return result
      },
    }),
    {
      name: 'sparta-skills',
      partialize: (state) => ({
        skills: state.skills,
        activeSkillIds: state.activeSkillIds,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) return
        const { skills, activeSkillIds } = useSkillStore.getState()
        const missing = skills.filter((s) => !activeSkillIds.includes(s.id)).map((s) => s.id)
        if (missing.length > 0) {
          useSkillStore.setState({ activeSkillIds: [...activeSkillIds, ...missing] })
        }
      },
    }
  )
)
