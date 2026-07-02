import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppShell } from './components/layout/AppShell'
import { ChatErrorBoundary } from './components/ErrorBoundary'
import { useChatStore } from './stores/chat.store'
import { initTheme } from './stores/theme.store'
import './styles/globals.css'
import './index.css'

initTheme()

// Clean up stale streaming sessions on app start
useChatStore.getState().cleanupStaleStreams()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChatErrorBoundary>
      <AppShell />
    </ChatErrorBoundary>
  </React.StrictMode>,
)
