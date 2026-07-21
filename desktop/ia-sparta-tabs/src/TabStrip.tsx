import { useCallback } from 'react'
import { useSessionTabsStore } from 'ia-sparta-core'
import { useSessionStore } from 'ia-sparta-core'
import { TabItem } from './TabItem'
import { NewTabButton } from './NewTabButton'

export function TabStrip() {
  const openTabs = useSessionTabsStore((s) => s.openTabs)
  const openTab = useSessionTabsStore((s) => s.openTab)
  const focusedTabId = useSessionTabsStore((s) => s.focusedTabId)
  const focusTab = useSessionTabsStore((s) => s.focusTab)
  const closeTab = useSessionTabsStore((s) => s.closeTab)
  const closeOtherTabs = useSessionTabsStore((s) => s.closeOtherTabs)
  const closeTabsToRight = useSessionTabsStore((s) => s.closeTabsToRight)
  const createSession = useSessionStore((s) => s.createSession)

  const handleNewTab = useCallback(() => {
    const id = createSession()
    openTab(id)
  }, [createSession, openTab])

  if (openTabs.length === 0) return null

  return (
    <div
      className="no-drag flex items-center gap-0.5 overflow-x-auto"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {openTabs.map((sid) => (
        <TabItem
          key={sid}
          sessionId={sid}
          isActive={sid === focusedTabId}
          onfocus={focusTab}
          onClose={closeTab}
          onCloseOthers={closeOtherTabs}
          onCloseToRight={closeTabsToRight}
        />
      ))}
      <NewTabButton onClick={handleNewTab} />
    </div>
  )
}
