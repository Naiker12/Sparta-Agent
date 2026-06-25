import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppShell } from './components/layout/AppShell'
import { initTheme } from './stores/theme.store'
import './styles/globals.css'
import './index.css'

initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
)
