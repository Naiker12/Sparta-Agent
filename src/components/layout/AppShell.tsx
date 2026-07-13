import { lazy, Suspense, useEffect, useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TitleBar } from './TitleBar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/sidebar/AppSidebar'
import { SidebarResizeHandle } from '@/components/sidebar/SidebarResizeHandle'
import { StatusBar } from './StatusBar'
import { Toaster } from '@/components/ui/sonner'
import { ChatArea } from '../chat/ChatArea'
import { SettingsDialog } from '../settings/SettingsDialog'
import { EditorPanel } from '@/components/editor/EditorPanel'
import { TerminalSlot } from '@/components/terminal/TerminalSlot'
import { PersistentTerminal } from '@/components/terminal/PersistentTerminal'
import { AgentsPanel } from '@/components/agents/AgentsPanel'
import { ChatErrorBoundary } from '@/components/ErrorBoundary'
import { PermissionRequestDialog } from '@/components/permission/PermissionRequestDialog'
import { DiffProposalDialog } from '@/components/permission/DiffProposalDialog'
import { initTheme } from '@/stores/theme.store'
import { useCronEngine } from '@/hooks/useCronEngine'
import { useSidecarToasts } from '@/hooks/useSidecarToasts'
import { useSettingsStore } from '@/stores/settings.store'
import { useUIStore } from '@/stores/ui.store'
import { useChatStore } from '@/stores/chat.store'
import { IS_ELECTRON } from '@/lib/env-adapter'

const SessionsView = lazy(() => import('@/components/views/SessionsView').then(m => ({ default: m.SessionsView })))
const SkillsView = lazy(() => import('@/components/views/SkillsView').then(m => ({ default: m.SkillsView })))
const McpView = lazy(() => import('@/components/views/McpView').then(m => ({ default: m.McpView })))
const ChannelsView = lazy(() => import('@/components/views/ChannelsView').then(m => ({ default: m.ChannelsView })))
const MemoryView = lazy(() => import('@/components/views/MemoryView').then(m => ({ default: m.MemoryView })))

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
  const { mainView, sidebarOpen, sidebarWidth, editorOpen, terminalOpen, editorWidth, terminalHeight } = useUIStore()

  const [isDraggingTerminal, setIsDraggingTerminal] = useState(false)
  const [isDraggingEditor, setIsDraggingEditor] = useState(false)

  const effectiveView = (mainView.type === 'editor' || mainView.type === 'terminal') ? 'chat' : mainView.type
  const isFullView = effectiveView !== 'chat'

  const containerRef = useRef<HTMLDivElement>(null)

  const handleEditorResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingEditor(true)

    const onMove = (ev: MouseEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const rawWidth = rect.right - ev.clientX

      if (rawWidth < 150) {
        useUIStore.setState({ editorOpen: false })
      } else {
        const newWidth = Math.min(800, Math.max(300, rawWidth))
        useUIStore.setState({ editorWidth: newWidth, editorOpen: true })
      }
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      setIsDraggingEditor(false)
    }

    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

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
                {FULL_VIEWS[effectiveView]}
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
                <AnimatePresence>
                  {editorOpen && IS_ELECTRON && (
                    <motion.div
                      key="editor-panel"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: editorWidth, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: isDraggingEditor ? 0 : 0.2, ease: 'easeInOut' }}
                      className="panel-editor"
                      style={{
                        flexShrink: 0,
                        borderLeft: '1px solid var(--border-normal)',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <EditorPanel />
                      <PanelDragHandle
                        className="editor-resize-handle"
                        onMouseDown={handleEditorResize}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </SidebarProvider>
      </div>
      <StatusBar />
      {settingsOpen && <SettingsDialog />}
      {isDraggingTerminal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, cursor: 'row-resize', background: 'transparent' }} />
      )}
      {isDraggingEditor && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, cursor: 'col-resize', background: 'transparent' }} />
      )}
      <Toaster position="top-center" richColors closeButton />
      <PermissionRequestDialog />
      <DiffProposalDialog />
    </div>
  )
}
