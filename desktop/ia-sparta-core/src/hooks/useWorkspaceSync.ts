import { useEffect } from 'react'
import { useEventBus } from '../stores/event-bus.store'
import { useFolderStore } from '../stores/folder.store'
import { activateWorkspace, deactivateWorkspace } from '../services/workspace/workspace-bridge'
import type { SpartaEvent } from '../types'

export function useWorkspaceSync() {
  useEffect(() => {
    // Sync initial state if folder is already connected
    const initialPath = useFolderStore.getState().connectedPath
    if (initialPath) {
      activateWorkspace(initialPath)
    }

    const unsubscribe = useEventBus.getState().subscribe((event: SpartaEvent) => {
      if (event.type === 'folder:connected') {
        activateWorkspace(event.path)
      } else if (event.type === 'folder:disconnected') {
        deactivateWorkspace()
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])
}
