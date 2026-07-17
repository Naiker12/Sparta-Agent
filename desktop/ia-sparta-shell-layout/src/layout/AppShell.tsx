import { lazy, Suspense, useEffect, useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { TitleBar } from './TitleBar'
import { SidebarProvider } from 'ia-sparta-design-system'
import { AppSidebar } from '../sidebar/AppSidebar'
import { SidebarResizeHandle } from '../sidebar/SidebarResizeHandle'
import { StatusBar } from './StatusBar'
import { Toaster } from 'ia-sparta-design-system'
import { ChatArea } from '../chat/ChatArea'
import { SettingsDialog } from '../settings/SettingsDialog'
import { TerminalSlot } from 'ia-sparta-terminal'
import { PersistentTerminal } from 'ia-sparta-terminal'
import { AgentsPanel } from 'ia-sparta-agents'
import { ChatErrorBoundary } from 'ia-sparta-core'
import { PermissionRequestDialog } from 'ia-sparta-permission'
import { DiffProposalDialog } from 'ia-sparta-permission'
import { initTheme } from 'ia-sparta-core'
import { useCronEngine } from 'ia-sparta-core'
import { useSidecarToasts } from 'ia-sparta-core'
import { useSettingsStore } from 'ia-sparta-core'
import { useUIStore } from 'ia-sparta-core'
import { useChatStore } from 'ia-sparta-core'
import { IS_ELECTRON } from 'ia-sparta-platform'

const EditorPanel = lazy(() => import('ia-sparta-editor').then(m => ({ default: m.EditorPanel })))

const SessionsView = lazy(() => import('../views/SessionsView').then(m => ({ default: m.SessionsView })))
const SkillsView = lazy(() => import('ia-sparta-skills').then(m => ({ default: m.SkillsView })))
const McpView = lazy(() => import('ia-sparta-mcp').then(m => ({ default: m.McpView })))
const ChannelsView = lazy(() => import('ia-sparta-channels').then(m => ({ default: m.ChannelsView })))
const MemoryView = lazy(() => import('ia-sparta-memory').then(m => ({ default: m.MemoryView })))

function ViewSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ minHeight: 200 }}>
      <div className="flex flex-col items-center gap-3">
        <div className="size-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-[var(--text-muted)]">Cargando...</span>
      </div>
    </div>
  )
}

function EditorSplitView({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }) {
  const { editorSplitWidth, setEditorSplitWidth } = useUIStore()

  return (
    <div className="flex flex-1 min-h-0 w-full h-full relative">
      <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <ChatErrorBoundary>
          <ChatArea />
        </ChatErrorBoundary>
      </div>
      <div
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const container = containerRef.current
          if (!container) return
          const rect = container.getBoundingClientRect()
          const totalW = rect.width
          const startX = e.clientX
          const startPercent = editorSplitWidth
          
          document.body.classList.add('is-resizing')
          
          function onMove(ev: MouseEvent) {
            const deltaX = ev.clientX - startX
            const deltaPercent = (deltaX / totalW) * 100
            const newPercent = startPercent - deltaPercent
            setEditorSplitWidth(newPercent)
          }
          
          function onUp() {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            document.body.classList.remove('is-resizing')
          }
          
          document.addEventListener('mousemove', onMove)
          document.addEventListener('mouseup', onUp)
        }}
        className="pane-resizer"
      />
      <div style={{ width: `${editorSplitWidth}%`, minWidth: '15%', maxWidth: '85%', height: '100%' }}>
        <Suspense fallback={<ViewSkeleton />}>
          <EditorPanel />
        </Suspense>
      </div>
    </div>
  )
}

const FULL_VIEWS: Record<string, React.ReactNode> = {
  agents: <AgentsPanel />,
  sessions: <Suspense fallback={<ViewSkeleton />}><SessionsView /></Suspense>,
  skills: <Suspense fallback={<ViewSkeleton />}><SkillsView /></Suspense>,
  mcp: <Suspense fallback={<ViewSkeleton />}><McpView /></Suspense>,
  channels: <Suspense fallback={<ViewSkeleton />}><ChannelsView /></Suspense>,
  memory: <Suspense fallback={<ViewSkeleton />}><MemoryView /></Suspense>,
}

function PanelDragHandle({ onMouseDown, className }: { onMouseDown: (e: React.MouseEvent) => void; className?: string }) {
  return (
    <div
      className={className}
      onMouseDown={onMouseDown}
      style={{ position: 'absolute', zIndex: 20 }}
    />
  )
}

export function AppShell() {
  useCronEngine()
  useSidecarToasts()

  useEffect(() => {
    initTheme()
    useChatStore.getState().cleanupStaleStreams()
  }, [])

  const { settingsOpen } = useSettingsStore()
  const { mainView, sidebarOpen, sidebarWidth, terminalOpen, terminalHeight } = useUIStore()

  const [isDraggingTerminal, setIsDraggingTerminal] = useState(false)

  const effectiveView = mainView.type === 'terminal' ? 'chat' : mainView.type
  const isFullView = effectiveView !== 'chat'

  const containerRef = useRef<HTMLDivElement>(null)

  const handleTerminalResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingTerminal(true)

    const onMove = (ev: MouseEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const rawHeight = rect.bottom - ev.clientY

      if (rawHeight < 60) {
        useUIStore.setState({ terminalOpen: false })
      } else {
        const newHeight = Math.min(500, Math.max(100, rawHeight))
        useUIStore.setState({ terminalHeight: newHeight, terminalOpen: true })
      }
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      setIsDraggingTerminal(false)
    }

    document.body.style.cursor = 'row-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-base)] overflow-hidden">
      <TitleBar />
      {IS_ELECTRON && <PersistentTerminal />}
      <div ref={containerRef} className="relative flex flex-1 min-h-0 overflow-hidden">
        <SidebarProvider
          open={sidebarOpen}
          onOpenChange={(open) => useUIStore.setState({ sidebarOpen: open })}
          style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
        >
          <div className="relative" style={{ flexShrink: 0 }}>
            <AppSidebar />
            <SidebarResizeHandle />
          </div>
          <div className="relative flex flex-1 min-h-0 overflow-hidden">
            {isFullView ? (
              <div
                key={effectiveView}
                className="flex flex-1 min-h-0"
                style={{ animation: 'viewFadeIn 0.18s ease-out' }}
              >
                {effectiveView === 'editor' ? (
                  <EditorSplitView containerRef={containerRef} />
                ) : (
                  FULL_VIEWS[effectiveView]
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-1 min-h-0 flex-col">
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ChatErrorBoundary>
                      <ChatArea />
                    </ChatErrorBoundary>
                  </div>
                  {IS_ELECTRON && (
                    <div className="relative" style={{ flexShrink: 0 }}>
                      {terminalOpen && <div className="border-t border-[var(--border-normal)]" />}
                      <motion.div
                        initial={false}
                        animate={{ height: terminalOpen ? terminalHeight : 0 }}
                        transition={{ duration: isDraggingTerminal ? 0 : 0.12, ease: 'easeOut' }}
                        style={{ overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}
                      >
                        <TerminalSlot />
                      </motion.div>
                      {terminalOpen && (
                        <PanelDragHandle
                          className="terminal-resize-handle"
                          onMouseDown={handleTerminalResize}
                        />
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </SidebarProvider>
      </div>
      <SidebarResizeHandle />
      <StatusBar />
      {settingsOpen && <SettingsDialog />}
      {isDraggingTerminal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'row-resize', background: 'transparent' }} />
      )}
      <Toaster position="top-center" richColors closeButton />
      <PermissionRequestDialog />
      <DiffProposalDialog />
    </div>
  )
}
