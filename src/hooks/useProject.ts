import { useProjectStore } from '@/stores/project.store'

export function useProject() {
  const store = useProjectStore()
  return {
    projects: store.projects,
    activeProject: store.getActiveProject(),
    activeProjectId: store.activeProjectId,
    addProject: store.addProject,
    switchProject: store.switchProject,
    deleteProject: store.deleteProject,
  }
}
