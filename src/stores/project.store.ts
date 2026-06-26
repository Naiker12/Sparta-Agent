import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project } from '@/types'
import { useEventBus } from './event-bus.store'

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  addProject: (name: string, description?: string) => string
  switchProject: (id: string) => void
  deleteProject: (id: string) => void
  getActiveProject: () => Project | null
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
  projects: [
    {
      id: 'default',
      name: 'sparta-agent',
      icon: '\uD83D\uDCC1',
      color: '#8b5cf6',
      createdAt: Date.now(),
      description: 'Proyecto principal',
      isTemplate: true,
    },
  ],
  activeProjectId: 'default',

  addProject: (name, description) => {
    const id = crypto.randomUUID()
    const project: Project = { id, name, description, createdAt: Date.now() }
    set((s) => ({ projects: [...s.projects, project], activeProjectId: id }))
    useEventBus.getState().dispatch({ type: 'project:created', projectId: id, timestamp: Date.now() })
    return id
  },

  switchProject: (id) => {
    set({ activeProjectId: id })
    useEventBus.getState().dispatch({ type: 'project:switched', projectId: id, timestamp: Date.now() })
  },

  deleteProject: (id) => {
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    }))
    useEventBus.getState().dispatch({ type: 'project:deleted', projectId: id, timestamp: Date.now() })
  },

  getActiveProject: () => {
    const { projects, activeProjectId } = get()
    if (!activeProjectId) return null
    return projects.find((p) => p.id === activeProjectId) ?? null
  },
}),
    { name: 'sparta-projects' }
  )
)
