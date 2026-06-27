import { lazy, Suspense, useEffect, useCallback, useRef } from 'react'
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
import { TerminalPanel } from '@/components/terminal/TerminalPanel'
import { AgentsPanel } from '@/components/agents/AgentsPanel'
import { initTheme } from '@/stores/theme.store'
import { useCronEngine } from '@/hooks/useCronEngine'
import { useSidecarToasts } from '@/hooks/useSidecarToasts'
import { useSettingsStore } from '@/stores/settings.store'
import { useUIStore } from '@/stores/ui.store'
import { useChatStore } from '@/stores/chat.store'

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
    useChatStore.getState().cleanupStaleSessions()
  }, [])

  const { settingsOpen } = useSettingsStore()
  const { mainView, sidebarOpen, sidebarWidth, editorOpen, terminalOpen, editorWidth, terminalHeight } = useUIStore()

  const effectiveView = (mainView.type === 'editor' || mainView.type === 'terminal') ? 'chat' : mainView.type
  const isFullView = effectiveView !== 'chat'

  const containerRef = useRef<HTMLDivElement>(null)

  const handleEditorResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()

    const onMove = (ev: MouseEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const newWidth = Math.min(800, Math.max(300, rect.right - ev.clientX))
      useUIStore.setState({ editorWidth: newWidth })
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }

    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const handleTerminalResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()

    const onMove = (ev: MouseEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const newHeight = Math.min(500, Math.max(100, rect.bottom - ev.clientY))
      useUIStore.setState({ terminalHeight: newHeight })
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }

    document.body.style.cursor = 'row-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-base)] overflow-hidden">
      <TitleBar />
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
                    <ChatArea />
                  </div>
                  <AnimatePresence>
                    {terminalOpen && (
                      <motion.div
                        key="terminal-panel"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: terminalHeight, opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="panel-terminal"
                        style={{
                          flexShrink: 0,
                          borderTop: '1px solid var(--border-normal)',
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <TerminalPanel />
                        <PanelDragHandle
                          className="terminal-resize-handle"
                          onMouseDown={handleTerminalResize}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <AnimatePresence>
                  {editorOpen && (
                    <motion.div
                      key="editor-panel"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: editorWidth, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
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
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}
