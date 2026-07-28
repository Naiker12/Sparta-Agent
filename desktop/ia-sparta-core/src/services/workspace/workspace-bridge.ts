import { useProjectStore } from '../../stores/project.store'
import { useMCPStore } from '../../stores/mcp.store'

export async function activateWorkspace(path: string): Promise<void> {
  if (!path) return

  // 1. Sincronizar con el store de proyectos
  const projectStore = useProjectStore.getState()
  const activeProject = projectStore.getActiveProject()
  const activeId = activeProject?.id || 'default'
  projectStore.setProjectRootPath(activeId, path)

  // 2. Notificar al proceso principal de Electron (seguridad y watcher de filesystem)
  if (typeof window !== 'undefined' && window.fs?.setWorkspaceRoot) {
    try {
      await window.fs.setWorkspaceRoot(path)
    } catch (err) {
      console.warn('[workspace-bridge] Error setting workspace root in electron main:', err)
    }
  }

  // 3. Auto-configurar servidor MCP "filesystem" con la ruta conectada
  try {
    const mcpStore = useMCPStore.getState()
    mcpStore.addServer({
      id: 'filesystem',
      name: 'Filesystem (Auto-Configured)',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', path],
      enabled: true,
    })
  } catch (err) {
    console.warn('[workspace-bridge] Could not auto-configure filesystem MCP server:', err)
  }
}

export async function deactivateWorkspace(): Promise<void> {
  const projectStore = useProjectStore.getState()
  const activeProject = projectStore.getActiveProject()
  if (activeProject) {
    projectStore.closeProject(activeProject.id)
  }

  if (typeof window !== 'undefined' && window.fs?.stopWatcher) {
    try {
      await window.fs.stopWatcher()
    } catch (err) {
      console.warn('[workspace-bridge] Error stopping workspace watcher:', err)
    }
  }
}
