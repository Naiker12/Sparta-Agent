import React from 'react'
import ReactDOM from 'react-dom/client'
import './lib/monaco-setup' // Must run before any Monaco import
import { AppShell } from './components/layout/AppShell'
import { ChatErrorBoundary } from './components/ErrorBoundary'
import { useChatStore } from './stores/chat.store'
import { useSecurityStore } from './stores/security.store'
import { initTheme } from './stores/theme.store'
import { IS_WEB } from './lib/env-adapter'
import { initWebTerminalDriver } from './lib/terminal-ws-driver'
import './styles/globals.css'
import './index.css'

initTheme()

// Clean up stale streaming sessions on app start
useChatStore.getState().cleanupStaleStreams()

// Initialize WebSocket terminal driver before React render (web mode only)
if (IS_WEB) {
  initWebTerminalDriver()
}

// Check security module status on startup (Electron only)
if (!IS_WEB) {
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
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChatErrorBoundary>
      <AppShell />
    </ChatErrorBoundary>
  </React.StrictMode>,
)
