import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppShell } from 'ia-sparta-shell-layout'
import { ChatErrorBoundary } from 'ia-sparta-core'
import { useChatStore } from 'ia-sparta-core'
import { useSecurityStore } from 'ia-sparta-core'
import { initTheme } from 'ia-sparta-core'
import '../../ia-sparta-core/src/styles/globals.css'
import '../../ia-sparta-core/src/index.css'

// Defer Monaco setup to unblock initial render
if (typeof window !== 'undefined') {
  const deferMonaco = () => { import('../../ia-sparta-core/src/lib/monaco-setup') }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(deferMonaco)
  } else {
    setTimeout(deferMonaco, 1000)
  }
}

initTheme()

// Clean up stale streaming sessions on app start
useChatStore.getState().cleanupStaleStreams()

// Check security module status on startup (Electron only)
window.electron?.invoke('security:status').then((status: unknown) => {
  const s = status as { loaded: boolean; auditEnabled: boolean; safeMode: boolean }
  useSecurityStore.getState().setStatus(s.loaded, s.auditEnabled, s.safeMode)
}).catch(() => {
  useSecurityStore.getState().setStatus(false, false, false)
})

// Listen for later changes
window.electron?.on('security:status-changed', (payload: unknown) => {
  const s = payload as { loaded: boolean; auditEnabled: boolean; safeMode: boolean }
  useSecurityStore.getState().setStatus(s.loaded, s.auditEnabled, s.safeMode)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChatErrorBoundary>
      <AppShell />
    </ChatErrorBoundary>
  </React.StrictMode>,
)
